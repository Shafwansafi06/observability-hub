#!/bin/bash
# =============================================================================
# 03-create-endpoint.sh - Create Vertex AI Endpoint
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
PROJECT_ID="${PROJECT_ID:-}"
REGION="${REGION:-us-central1}"
ENDPOINT_NAME=""
NETWORK=""
ENCRYPTION_KEY=""

usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Create a Vertex AI endpoint

OPTIONS:
    --endpoint-name=NAME    Endpoint display name (required)
    --network=NETWORK       VPC network (optional, for private endpoint)
    --encryption-key=KEY    Customer-managed encryption key (optional)

EXAMPLES:
    # Create public endpoint
    $0 --endpoint-name=production-endpoint

    # Create private endpoint with VPC
    $0 --endpoint-name=production-endpoint --network=projects/PROJECT_ID/global/networks/vertex-ai-vpc

EOF
    exit 1
}

for arg in "$@"; do
    case $arg in
        --endpoint-name=*) ENDPOINT_NAME="${arg#*=}"; shift ;;
        --network=*) NETWORK="${arg#*=}"; shift ;;
        --encryption-key=*) ENCRYPTION_KEY="${arg#*=}"; shift ;;
        --help) usage ;;
        *) log_error "Unknown option: $arg"; usage ;;
    esac
done

if [ -z "$ENDPOINT_NAME" ]; then
    log_error "Missing required parameter: --endpoint-name"
    usage
fi

create_endpoint() {
    log_info "Creating endpoint: $ENDPOINT_NAME"
    
    local cmd="gcloud ai endpoints create \
        --region=$REGION \
        --display-name=$ENDPOINT_NAME \
        --project=$PROJECT_ID"
    
    if [ -n "$NETWORK" ]; then
        cmd="$cmd --network=$NETWORK"
        log_info "Using VPC network: $NETWORK"
    fi
    
    if [ -n "$ENCRYPTION_KEY" ]; then
        cmd="$cmd --encryption-spec-key-name=$ENCRYPTION_KEY"
        log_info "Using encryption key: $ENCRYPTION_KEY"
    fi
    
    local endpoint_id
    endpoint_id=$($cmd --format="value(name)" 2>&1 | grep -oP 'endpoints/\K[0-9]+' | head -n1)
    
    if [ -z "$endpoint_id" ]; then
        log_error "Failed to create endpoint"
        exit 1
    fi
    
    log_info "✓ Endpoint created successfully!"
    log_info "Endpoint ID: $endpoint_id"
    
    # Add labels
    gcloud ai endpoints update "$endpoint_id" \
        --region="$REGION" \
        --update-labels="environment=production,managed-by=terraform" \
        --project="$PROJECT_ID" &>/dev/null || true
    
    echo "$endpoint_id"
}

configure_logging() {
    local endpoint_id=$1
    
    log_info "Configuring logging..."
    
    # Enable request-response logging
    gcloud ai endpoints update "$endpoint_id" \
        --region="$REGION" \
        --enable-access-logging \
        --request-response-logging-rate=1.0 \
        --project="$PROJECT_ID" || true
    
    log_info "✓ Logging configured"
}

setup_monitoring() {
    local endpoint_id=$1
    
    log_info "Setting up monitoring..."
    
    # Create alert policy for endpoint health
    cat > /tmp/alert-policy.yaml <<EOF
displayName: "Vertex AI Endpoint Down - ${ENDPOINT_NAME}"
conditions:
  - displayName: "Endpoint Health Check Failed"
    conditionThreshold:
      filter: |
        resource.type = "aiplatform.googleapis.com/Endpoint"
        resource.labels.endpoint_id = "${endpoint_id}"
        metric.type = "aiplatform.googleapis.com/prediction/error_count"
      comparison: COMPARISON_GT
      thresholdValue: 10
      duration: 300s
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_RATE
notificationChannels: []
alertStrategy:
  autoClose: 1800s
EOF
    
    gcloud alpha monitoring policies create --policy-from-file=/tmp/alert-policy.yaml \
        --project="$PROJECT_ID" &>/dev/null || true
    rm /tmp/alert-policy.yaml
    
    log_info "✓ Monitoring configured"
}

print_summary() {
    local endpoint_id=$1
    
    log_info "============================================"
    log_info "Endpoint Created!"
    log_info "============================================"
    log_info ""
    log_info "Endpoint Name: $ENDPOINT_NAME"
    log_info "Endpoint ID: $endpoint_id"
    log_info "Region: $REGION"
    log_info ""
    log_info "View in Console:"
    log_info "  https://console.cloud.google.com/vertex-ai/endpoints/$endpoint_id?project=$PROJECT_ID"
    log_info ""
    log_info "Next steps:"
    log_info "  1. Deploy model: ./scripts/04-deploy-model.sh --endpoint-id=$endpoint_id --model-id=MODEL_ID"
    log_info ""
    log_info "Export endpoint ID:"
    echo "export ENDPOINT_ID=\"$endpoint_id\""
}

main() {
    log_info "Creating Vertex AI endpoint..."
    
    endpoint_id=$(create_endpoint)
    configure_logging "$endpoint_id"
    setup_monitoring "$endpoint_id"
    print_summary "$endpoint_id"
    
    log_info "✓ Endpoint creation complete!"
}

main "$@"
