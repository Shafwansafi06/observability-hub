-- =====================================================
-- ObservAI Hub - Initial Schema Migration
-- Version: 00001
-- Description: Core tables for organizations, users, projects, and API keys
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create custom schema for ObservAI
CREATE SCHEMA IF NOT EXISTS observai;

-- =====================================================
-- ENUM TYPES
-- =====================================================

-- Organization member roles
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- Project status
CREATE TYPE public.project_status AS ENUM ('active', 'paused', 'archived');

-- API key status
CREATE TYPE public.api_key_status AS ENUM ('active', 'revoked', 'expired');

-- Subscription tier
CREATE TYPE public.subscription_tier AS ENUM ('free', 'pro', 'enterprise');

-- =====================================================
-- ORGANIZATIONS TABLE
-- =====================================================

CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    
    -- Subscription & billing
    subscription_tier public.subscription_tier NOT NULL DEFAULT 'free',
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    
    -- Limits based on tier
    max_projects INTEGER NOT NULL DEFAULT 3,
    max_events_per_month BIGINT NOT NULL DEFAULT 100000,
    max_retention_days INTEGER NOT NULL DEFAULT 30,
    max_members INTEGER NOT NULL DEFAULT 5,
    
    -- Usage tracking
    current_events_count BIGINT NOT NULL DEFAULT 0,
    events_reset_at TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
    
    -- Settings
    settings JSONB NOT NULL DEFAULT '{
        "timezone": "UTC",
        "date_format": "YYYY-MM-DD",
        "notifications": {
            "email": true,
            "slack": false,
            "pagerduty": false
        },
        "data_retention": {
            "logs_days": 30,
            "metrics_days": 90,
            "traces_days": 14
        }
    }'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
    CONSTRAINT organizations_name_length CHECK (char_length(name) >= 2)
);

-- =====================================================
-- ORGANIZATION MEMBERS TABLE
-- =====================================================

CREATE TABLE public.organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.org_role NOT NULL DEFAULT 'member',
    
    -- Invitation tracking
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT organization_members_unique UNIQUE (organization_id, user_id)
);

-- =====================================================
-- USER PROFILES TABLE
-- =====================================================

CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    
    -- Preferences
    preferences JSONB NOT NULL DEFAULT '{
        "theme": "dark",
        "language": "en",
        "email_notifications": true,
        "weekly_digest": true
    }'::jsonb,
    
    -- Active organization (for quick switching)
    current_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    
    -- GDPR compliance
    gdpr_consent_at TIMESTAMPTZ,
    marketing_consent BOOLEAN NOT NULL DEFAULT false,
    data_processing_consent BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadata
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- PROJECTS TABLE
-- =====================================================

CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    status public.project_status NOT NULL DEFAULT 'active',
    
    -- Project configuration
    config JSONB NOT NULL DEFAULT '{
        "ingestion": {
            "batch_size": 100,
            "flush_interval_ms": 5000,
            "max_batch_delay_ms": 10000
        },
        "sampling": {
            "rate": 1.0,
            "rules": []
        },
        "pii_masking": {
            "enabled": true,
            "patterns": ["email", "phone", "ssn", "credit_card"]
        }
    }'::jsonb,
    
    -- Environment configuration
    environments JSONB NOT NULL DEFAULT '[
        {"name": "production", "color": "#ef4444"},
        {"name": "staging", "color": "#f59e0b"},
        {"name": "development", "color": "#22c55e"}
    ]'::jsonb,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT projects_slug_unique UNIQUE (organization_id, slug),
    CONSTRAINT projects_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$')
);

-- =====================================================
-- API KEYS TABLE
-- =====================================================

CREATE TABLE public.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    
    -- Key details
    name VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(8) NOT NULL,  -- e.g., "oah_live_" or "oah_test_"
    key_hash VARCHAR(64) NOT NULL,   -- SHA-256 hash of the full key
    
    -- Permissions
    scopes TEXT[] NOT NULL DEFAULT ARRAY['read', 'write'],
    environment VARCHAR(50) NOT NULL DEFAULT 'production',
    
    -- Status & lifecycle
    status public.api_key_status NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    usage_count BIGINT NOT NULL DEFAULT 0,
    
    -- Rate limiting
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 1000,
    rate_limit_per_day INTEGER NOT NULL DEFAULT 100000,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    revoked_by UUID REFERENCES auth.users(id),
    revoked_at TIMESTAMPTZ,
    revoke_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT api_keys_key_hash_unique UNIQUE (key_hash)
);

-- =====================================================
-- AUDIT LOG TABLE
-- =====================================================

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Action details
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    request_id UUID,
    
    -- Changes
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    
    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Partition key for time-based partitioning
    created_date DATE NOT NULL DEFAULT CURRENT_DATE
) PARTITION BY RANGE (created_date);

-- Create partitions for audit logs (current month + 3 months ahead)
CREATE TABLE public.audit_logs_default PARTITION OF public.audit_logs DEFAULT;

-- =====================================================
-- INDEXES
-- =====================================================

-- Organizations
CREATE INDEX idx_organizations_slug ON public.organizations(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_stripe_customer ON public.organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Organization Members
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);

-- User Profiles
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_user_profiles_current_org ON public.user_profiles(current_organization_id);

-- Projects
CREATE INDEX idx_projects_org ON public.projects(organization_id) WHERE archived_at IS NULL;
CREATE INDEX idx_projects_status ON public.projects(organization_id, status);

-- API Keys
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash) WHERE status = 'active';
CREATE INDEX idx_api_keys_org ON public.api_keys(organization_id) WHERE status = 'active';
CREATE INDEX idx_api_keys_project ON public.api_keys(project_id) WHERE status = 'active';

-- Audit Logs
CREATE INDEX idx_audit_logs_org ON public.audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organization_members_updated_at
    BEFORE UPDATE ON public.organization_members
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON public.api_keys
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to generate API key prefix
CREATE OR REPLACE FUNCTION public.generate_api_key_prefix(env VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
    IF env = 'production' THEN
        RETURN 'oah_live_';
    ELSE
        RETURN 'oah_test_';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to validate API key and return associated data
CREATE OR REPLACE FUNCTION public.validate_api_key(key_hash_input VARCHAR)
RETURNS TABLE (
    api_key_id UUID,
    organization_id UUID,
    project_id UUID,
    scopes TEXT[],
    rate_limit_per_minute INTEGER,
    rate_limit_per_day INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ak.id,
        ak.organization_id,
        ak.project_id,
        ak.scopes,
        ak.rate_limit_per_minute,
        ak.rate_limit_per_day
    FROM public.api_keys ak
    WHERE ak.key_hash = key_hash_input
        AND ak.status = 'active'
        AND (ak.expires_at IS NULL OR ak.expires_at > now());
    
    -- Update last_used_at and usage_count
    UPDATE public.api_keys
    SET last_used_at = now(), usage_count = usage_count + 1
    WHERE api_keys.key_hash = key_hash_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check organization limits
CREATE OR REPLACE FUNCTION public.check_organization_limits(org_id UUID, resource_type VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    org_record RECORD;
    current_count INTEGER;
BEGIN
    SELECT * INTO org_record FROM public.organizations WHERE id = org_id;
    
    IF resource_type = 'projects' THEN
        SELECT COUNT(*) INTO current_count 
        FROM public.projects 
        WHERE organization_id = org_id AND archived_at IS NULL;
        RETURN current_count < org_record.max_projects;
    ELSIF resource_type = 'members' THEN
        SELECT COUNT(*) INTO current_count 
        FROM public.organization_members 
        WHERE organization_id = org_id;
        RETURN current_count < org_record.max_members;
    ELSIF resource_type = 'events' THEN
        -- Reset counter if needed
        IF org_record.events_reset_at <= now() THEN
            UPDATE public.organizations 
            SET current_events_count = 0,
                events_reset_at = date_trunc('month', now()) + interval '1 month'
            WHERE id = org_id;
            RETURN TRUE;
        END IF;
        RETURN org_record.current_events_count < org_record.max_events_per_month;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.organizations IS 'Organizations represent tenants in the multi-tenant system';
COMMENT ON TABLE public.organization_members IS 'Junction table for organization membership with roles';
COMMENT ON TABLE public.user_profiles IS 'Extended user profile data, linked to auth.users';
COMMENT ON TABLE public.projects IS 'Projects within organizations for logical grouping of observability data';
COMMENT ON TABLE public.api_keys IS 'API keys for programmatic access to the platform';
COMMENT ON TABLE public.audit_logs IS 'Audit trail for compliance and security monitoring';
