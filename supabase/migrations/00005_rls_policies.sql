-- =====================================================
-- ObservAI Hub - Row Level Security Policies
-- Version: 00005
-- Description: Comprehensive RLS policies for multi-tenant security
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_aggregated ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oncall_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_comments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTIONS FOR RLS
-- =====================================================

-- Get organizations the current user belongs to
CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF UUID AS $$
BEGIN
    RETURN QUERY
    SELECT om.organization_id
    FROM public.organization_members om
    WHERE om.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user has specific role in organization
CREATE OR REPLACE FUNCTION public.has_org_role(
    org_id UUID,
    required_roles public.org_role[]
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.organization_members om
        WHERE om.organization_id = org_id
          AND om.user_id = auth.uid()
          AND om.role = ANY(required_roles)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is member of organization
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.organization_members om
        WHERE om.organization_id = org_id
          AND om.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is owner or admin of organization
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.has_org_role(org_id, ARRAY['owner', 'admin']::public.org_role[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- ORGANIZATIONS POLICIES
-- =====================================================

-- Users can view organizations they belong to
CREATE POLICY "Users can view their organizations"
    ON public.organizations
    FOR SELECT
    USING (id IN (SELECT public.get_user_organizations()));

-- Only owners/admins can update organization
CREATE POLICY "Admins can update organizations"
    ON public.organizations
    FOR UPDATE
    USING (public.is_org_admin(id));

-- Anyone can create an organization (becomes owner)
CREATE POLICY "Users can create organizations"
    ON public.organizations
    FOR INSERT
    WITH CHECK (true);

-- Only owners can delete organization
CREATE POLICY "Owners can delete organizations"
    ON public.organizations
    FOR DELETE
    USING (public.has_org_role(id, ARRAY['owner']::public.org_role[]));

-- =====================================================
-- ORGANIZATION MEMBERS POLICIES
-- =====================================================

-- Members can view other members in their org
CREATE POLICY "Members can view org members"
    ON public.organization_members
    FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organizations()));

-- Admins can add members
CREATE POLICY "Admins can add org members"
    ON public.organization_members
    FOR INSERT
    WITH CHECK (public.is_org_admin(organization_id));

-- Admins can update member roles
CREATE POLICY "Admins can update org members"
    ON public.organization_members
    FOR UPDATE
    USING (public.is_org_admin(organization_id));

-- Admins can remove members (but not the last owner)
CREATE POLICY "Admins can remove org members"
    ON public.organization_members
    FOR DELETE
    USING (
        public.is_org_admin(organization_id)
        AND NOT (
            role = 'owner' 
            AND (SELECT COUNT(*) FROM public.organization_members 
                 WHERE organization_id = organization_members.organization_id 
                 AND role = 'owner') <= 1
        )
    );

-- =====================================================
-- USER PROFILES POLICIES
-- =====================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.user_profiles
    FOR SELECT
    USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.user_profiles
    FOR UPDATE
    USING (id = auth.uid());

-- Users can view profiles of users in same organizations
CREATE POLICY "Users can view org member profiles"
    ON public.user_profiles
    FOR SELECT
    USING (
        id IN (
            SELECT om.user_id 
            FROM public.organization_members om
            WHERE om.organization_id IN (SELECT public.get_user_organizations())
        )
    );

-- =====================================================
-- PROJECTS POLICIES
-- =====================================================

-- Members can view projects in their orgs
CREATE POLICY "Members can view projects"
    ON public.projects
    FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organizations()));

-- Admins can create projects
CREATE POLICY "Admins can create projects"
    ON public.projects
    FOR INSERT
    WITH CHECK (public.is_org_admin(organization_id));

-- Admins can update projects
CREATE POLICY "Admins can update projects"
    ON public.projects
    FOR UPDATE
    USING (public.is_org_admin(organization_id));

-- Admins can delete projects
CREATE POLICY "Admins can delete projects"
    ON public.projects
    FOR DELETE
    USING (public.is_org_admin(organization_id));

-- =====================================================
-- API KEYS POLICIES
-- =====================================================

-- Admins can view API keys (but not the actual key)
CREATE POLICY "Admins can view API keys"
    ON public.api_keys
    FOR SELECT
    USING (public.is_org_admin(organization_id));

-- Admins can create API keys
CREATE POLICY "Admins can create API keys"
    ON public.api_keys
    FOR INSERT
    WITH CHECK (public.is_org_admin(organization_id));

-- Admins can update (revoke) API keys
CREATE POLICY "Admins can update API keys"
    ON public.api_keys
    FOR UPDATE
    USING (public.is_org_admin(organization_id));

-- =====================================================
-- AUDIT LOGS POLICIES
-- =====================================================

-- Admins can view audit logs for their org
CREATE POLICY "Admins can view audit logs"
    ON public.audit_logs
    FOR SELECT
    USING (public.is_org_admin(organization_id));

-- Insert is done via service role (not user)
-- No user-facing insert policy needed

-- =====================================================
-- METRICS POLICIES
-- =====================================================

-- Members can view metrics
CREATE POLICY "Members can view metrics"
    ON public.metrics
    FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organizations()));

-- Insert is done via API key (service role)
CREATE POLICY "Service can insert metrics"
    ON public.metrics
    FOR INSERT
    WITH CHECK (true); -- Controlled at API layer

CREATE POLICY "Members can view metric definitions"
    ON public.metric_definitions
    FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Admins can manage metric definitions"
    ON public.metric_definitions
    FOR ALL
    USING (public.is_org_admin(organization_id));

CREATE POLICY "Members can view aggregated metrics"
    ON public.metrics_aggregated
    FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Members can view LLM metrics"
    ON public.llm_metrics
    FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Service can insert LLM metrics"
    ON public.llm_metrics
    FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- LOGS POLICIES
-- =====================================================

CREATE POLICY "Members can view logs"
    ON public.logs
    FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Service can insert logs"
    ON public.logs
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Members can view traces"
    ON public.traces
    FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Service can insert traces"
    ON public.traces
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service can update traces"
    ON public.traces
    FOR UPDATE
    USING (true);

CREATE POLICY "Members can view spans"
    ON public.spans
    FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Service can insert spans"
    ON public.spans
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Members can view log patterns"
    ON public.log_patterns
    FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Members can update log patterns"
    ON public.log_patterns
    FOR UPDATE
    USING (public.is_org_member(organization_id));

-- =====================================================
-- SAVED SEARCHES POLICIES
-- =====================================================

-- Users can view their own saved searches
CREATE POLICY "Users can view own saved searches"
    ON public.saved_searches
    FOR SELECT
    USING (user_id = auth.uid());

-- Users can view shared searches in their org
CREATE POLICY "Users can view shared searches"
    ON public.saved_searches
    FOR SELECT
    USING (
        is_shared = true 
        AND organization_id IN (SELECT public.get_user_organizations())
    );

-- Users can create saved searches
CREATE POLICY "Users can create saved searches"
    ON public.saved_searches
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND organization_id IN (SELECT public.get_user_organizations())
    );

-- Users can update their own saved searches
CREATE POLICY "Users can update own saved searches"
    ON public.saved_searches
    FOR UPDATE
    USING (user_id = auth.uid());

-- Users can delete their own saved searches
CREATE POLICY "Users can delete own saved searches"
    ON public.saved_searches
    FOR DELETE
    USING (user_id = auth.uid());

-- =====================================================
-- ALERTS POLICIES
-- =====================================================

CREATE POLICY "Members can view alert rules"
    ON public.alert_rules
    FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Admins can manage alert rules"
    ON public.alert_rules
    FOR ALL
    USING (public.is_org_admin(organization_id));

CREATE POLICY "Members can view alerts"
    ON public.alerts
    FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Members can update alerts"
    ON public.alerts
    FOR UPDATE
    USING (public.is_org_member(organization_id));

CREATE POLICY "Service can insert alerts"
    ON public.alerts
    FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- NOTIFICATION POLICIES
-- =====================================================

CREATE POLICY "Members can view notification channels"
    ON public.notification_channels
    FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Admins can manage notification channels"
    ON public.notification_channels
    FOR ALL
    USING (public.is_org_admin(organization_id));

CREATE POLICY "Members can view notification history"
    ON public.notification_history
    FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organizations()));

-- =====================================================
-- ANOMALIES POLICIES
-- =====================================================

CREATE POLICY "Members can view anomalies"
    ON public.anomalies
    FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Members can update anomalies"
    ON public.anomalies
    FOR UPDATE
    USING (public.is_org_member(organization_id));

CREATE POLICY "Service can insert anomalies"
    ON public.anomalies
    FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- ON-CALL SCHEDULES POLICIES
-- =====================================================

CREATE POLICY "Members can view on-call schedules"
    ON public.oncall_schedules
    FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Admins can manage on-call schedules"
    ON public.oncall_schedules
    FOR ALL
    USING (public.is_org_admin(organization_id));

-- =====================================================
-- ALERT COMMENTS POLICIES
-- =====================================================

CREATE POLICY "Members can view alert comments"
    ON public.alert_comments
    FOR SELECT
    USING (
        alert_id IN (
            SELECT id FROM public.alerts 
            WHERE organization_id IN (SELECT public.get_user_organizations())
        )
    );

CREATE POLICY "Members can add alert comments"
    ON public.alert_comments
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND alert_id IN (
            SELECT id FROM public.alerts 
            WHERE organization_id IN (SELECT public.get_user_organizations())
        )
    );

CREATE POLICY "Users can update own comments"
    ON public.alert_comments
    FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own comments"
    ON public.alert_comments
    FOR DELETE
    USING (user_id = auth.uid());

-- =====================================================
-- SERVICE ROLE BYPASS
-- =====================================================

-- Create a function that can be used by service role to bypass RLS
CREATE OR REPLACE FUNCTION public.bypass_rls()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_setting('request.jwt.claims', true)::json->>'role' = 'service_role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION public.get_user_organizations IS 'Returns organization IDs for the current authenticated user';
COMMENT ON FUNCTION public.has_org_role IS 'Checks if current user has any of the specified roles in an organization';
COMMENT ON FUNCTION public.is_org_member IS 'Checks if current user is a member of the specified organization';
COMMENT ON FUNCTION public.is_org_admin IS 'Checks if current user is an owner or admin of the specified organization';
