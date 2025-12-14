#!/bin/bash

# ObservAI SDK - Deployment Script
# Deploys the entire tracking pipeline

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 ObservAI SDK Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. Installing..."
    npm install -g supabase
fi

echo "✅ Prerequisites OK"
echo ""

# Build SDK
echo "📦 Building SDK..."
cd sdk
npm install
npm run build
echo "✅ SDK built successfully"
echo ""

# Deploy Edge Function
echo "🌐 Deploying Supabase Edge Function..."
cd ..

# Check if Supabase is linked
if [ ! -f .supabase/config.toml ]; then
    echo "⚠️  Supabase project not linked. Run:"
    echo "   supabase link --project-ref your-project-ref"
    echo ""
    read -p "Enter your Supabase project ref: " PROJECT_REF
    supabase link --project-ref "$PROJECT_REF"
fi

# Deploy function
supabase functions deploy track-llm --no-verify-jwt

echo "✅ Edge function deployed"
echo ""

# Set secrets
echo "🔐 Setting environment variables..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    exit 1
fi

# Load .env
export $(cat .env | grep -v '^#' | xargs)

# Set Supabase secrets
supabase secrets set \
    SUPABASE_URL="$VITE_SUPABASE_URL" \
    SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"

echo "✅ Secrets configured"
echo ""

# Test deployment
echo "🧪 Testing deployment..."

ENDPOINT="$VITE_SUPABASE_URL/functions/v1/track-llm"

TEST_PAYLOAD='{
  "requests": [{
    "request_id": "test-deployment",
    "user_id": "deployment-test",
    "model": "gemini-2.5-flash",
    "prompt": "Test deployment",
    "response": "Deployment successful!",
    "latency_ms": 1000,
    "tokens_in": 10,
    "tokens_out": 20,
    "tokens_total": 30,
    "cost_usd": 0.00001,
    "success": true,
    "retry_count": 0,
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }],
  "batch_id": "deployment-test-batch",
  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}'

RESPONSE=$(curl -s -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
    -d "$TEST_PAYLOAD")

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ Test passed - pipeline is working!"
else
    echo "❌ Test failed:"
    echo "$RESPONSE"
    exit 1
fi

echo ""

# Print summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✨ Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 SDK Location:"
echo "   $(pwd)/sdk/dist/"
echo ""
echo "🌐 Ingestion Endpoint:"
echo "   $ENDPOINT"
echo ""
echo "📊 Dashboard:"
echo "   http://localhost:5173/dashboard (dev)"
echo "   $VITE_SUPABASE_URL (production)"
echo ""
echo "📖 Next Steps:"
echo ""
echo "  1. Use the SDK in your projects:"
echo "     npm link $(pwd)/sdk"
echo ""
echo "  2. Or publish to npm:"
echo "     cd sdk && npm publish"
echo ""
echo "  3. Integrate in any project:"
echo "     import { ObservAIClient } from '@observai/sdk';"
echo ""
echo "  4. Check examples:"
echo "     cd sdk/examples && tsx usage.ts"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
