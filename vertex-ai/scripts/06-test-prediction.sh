#!/bin/bash
# Test Vertex AI Endpoint Prediction
# Sends test requests to verify endpoint functionality

set -euo pipefail

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-observability-hub-prod}"
REGION="${VERTEX_AI_REGION:-us-central1}"
ENDPOINT_ID="${1}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

if [ -z "$ENDPOINT_ID" ]; then
    log_error "Usage: $0 <endpoint-id>"
    echo "Example: $0 1234567890"
    exit 1
fi

ENDPOINT_RESOURCE_NAME="projects/$PROJECT_ID/locations/$REGION/endpoints/$ENDPOINT_ID"

log_info "========================================="
log_info "Testing Vertex AI Endpoint"
log_info "========================================="
echo "Endpoint: $ENDPOINT_RESOURCE_NAME"
echo ""

# Test 1: Simple prediction
log_info "Test 1: Simple text generation"
cat > /tmp/test-request-1.json <<EOF
{
  "instances": [
    {
      "prompt": "Explain what is machine learning in one sentence.",
      "max_tokens": 100,
      "temperature": 0.7
    }
  ]
}
EOF

log_info "Sending prediction request..."
RESPONSE_1=$(gcloud ai endpoints predict "$ENDPOINT_ID" \
    --region="$REGION" \
    --json-request=/tmp/test-request-1.json 2>&1)

if echo "$RESPONSE_1" | grep -q "predictions"; then
    log_info "✅ Test 1 passed"
    echo "$RESPONSE_1" | jq '.predictions[0]' 2>/dev/null || echo "$RESPONSE_1"
else
    log_error "❌ Test 1 failed"
    echo "$RESPONSE_1"
fi

echo ""
sleep 2

# Test 2: Batch prediction
log_info "Test 2: Batch predictions"
cat > /tmp/test-request-2.json <<EOF
{
  "instances": [
    {"prompt": "What is AI?", "max_tokens": 50},
    {"prompt": "Define neural networks.", "max_tokens": 50},
    {"prompt": "Explain deep learning.", "max_tokens": 50}
  ]
}
EOF

log_info "Sending batch prediction request..."
RESPONSE_2=$(gcloud ai endpoints predict "$ENDPOINT_ID" \
    --region="$REGION" \
    --json-request=/tmp/test-request-2.json 2>&1)

if echo "$RESPONSE_2" | grep -q "predictions"; then
    log_info "✅ Test 2 passed"
    echo "$RESPONSE_2" | jq '.predictions | length' 2>/dev/null | xargs -I {} echo "Received {} predictions"
else
    log_error "❌ Test 2 failed"
    echo "$RESPONSE_2"
fi

echo ""
sleep 2

# Test 3: Load test (10 concurrent requests)
log_info "Test 3: Load test (10 concurrent requests)"

for i in {1..10}; do
    (
        cat > /tmp/test-request-$i.json <<EOF
{
  "instances": [{"prompt": "Test request $i", "max_tokens": 20}]
}
EOF
        gcloud ai endpoints predict "$ENDPOINT_ID" \
            --region="$REGION" \
            --json-request=/tmp/test-request-$i.json \
            > /tmp/test-response-$i.json 2>&1
    ) &
done

wait

SUCCESS_COUNT=0
for i in {1..10}; do
    if grep -q "predictions" /tmp/test-response-$i.json 2>/dev/null; then
        ((SUCCESS_COUNT++))
    fi
done

log_info "Load test results: $SUCCESS_COUNT/10 requests succeeded"

if [ "$SUCCESS_COUNT" -ge 8 ]; then
    log_info "✅ Test 3 passed (80%+ success rate)"
else
    log_error "❌ Test 3 failed (below 80% success rate)"
fi

# Cleanup
rm -f /tmp/test-request-*.json /tmp/test-response-*.json

echo ""
log_info "========================================="
log_info "Testing Complete!"
log_info "========================================="
echo ""
echo "View logs in Cloud Console:"
echo "https://console.cloud.google.com/logs/query;query=resource.type%3D%22aiplatform.googleapis.com%2FEndpoint%22%0Aresource.labels.endpoint_id%3D%22$ENDPOINT_ID%22?project=$PROJECT_ID"
echo ""
echo "View metrics in Cloud Monitoring:"
echo "https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"
echo ""
