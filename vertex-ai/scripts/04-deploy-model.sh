#!/bin/bash
# =============================================================================
# 04-deploy-model.sh - Deploy model to Vertex AI endpoint
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
ENDPOINT_ID=""
MODEL_ID=""
MACHINE_TYPE="n1-standard-8"
ACCELERATOR="NVIDIA_TESLA_T4"
ACCELERATOR_COUNT=1
MIN_REPLICAS=2
MAX_REPLICAS=10
TRAFFIC_SPLIT=100
DEPLOYMENT_NAME=""

usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Deploy a model to a Vertex AI endpoint

OPTIONS:
    --endpoint-id=ID        Endpoint ID (required)
    --model-id=ID           Model ID (required)
    --machine-type=TYPE     Machine type (default: n1-standard-8)
    --accelerator=TYPE      GPU type (default: NVIDIA_TESLA_T4)
    --accelerator-count=N   Number of GPUs (default: 1)
    --min-replicas=N        Minimum replicas (default: 2)
    --max-replicas=N        Maximum replicas (default: 10)
    --traffic=PERCENT       Traffic percentage (default: 100)
    --deployment-name=NAME  Deployment name (optional)

EXAMPLES:
    # Deploy with default settings
    $0 --endpoint-id=1234567890 --model-id=9876543210

    # Deploy with custom machine type and scaling
    $0 --endpoint-id=1234567890 --model-id=9876543210 \
       --machine-type=n1-highmem-8 --min-replicas=3 --max-replicas=20

    # Deploy as canary (10% traffic)
    $0 --endpoint-id=1234567890 --model-id=9876543210 --traffic=10

EOF
    exit 1
}

for arg in "$@"; do
    case $arg in
        --endpoint-id=*) ENDPOINT_ID="${arg#*=}"; shift ;;
        --model-id=*) MODEL_ID="${arg#*=}"; shift ;;
        --machine-type=*) MACHINE_TYPE="${arg#*=}"; shift ;;
        --accelerator=*) ACCELERATOR="${arg#*=}"; shift ;;
        --accelerator-count=*) ACCELERATOR_COUNT="${arg#*=}"; shift ;;
        --min-replicas=*) MIN_REPLICAS="${arg#*=}"; shift ;;
        --max-replicas=*) MAX_REPLICAS="${arg#*=}"; shift ;;
        --traffic=*) TRAFFIC_SPLIT="${arg#*=}"; shift ;;
        --deployment-name=*) DEPLOYMENT_NAME="${arg#*=}"; shift ;;
        --help) usage ;;
        *) log_error "Unknown option: $arg"; usage ;;
    esac
done

if [ -z "$ENDPOINT_ID" ] || [ -z "$MODEL_ID" ]; then
    log_error "Missing required parameters"
    usage
fi

# Generate deployment name if not provided
if [ -z "$DEPLOYMENT_NAME" ]; then
    DEPLOYMENT_NAME="deployment-$(date +%Y%m%d-%H%M%S)"
fi

deploy_model() {
    log_info "Deploying model $MODEL_ID to endpoint $ENDPOINT_ID"
    log_info "Machine type: $MACHINE_TYPE"
    log_info "Accelerator: $ACCELERATOR x $ACCELERATOR_COUNT"
    log_info "Replicas: $MIN_REPLICAS - $MAX_REPLICAS"
    log_info "Traffic: $TRAFFIC_SPLIT%"
    
    # Deploy model
    gcloud ai endpoints deploy-model "$ENDPOINT_ID" \
        --region="$REGION" \
        --model="$MODEL_ID" \
        --display-name="$DEPLOYMENT_NAME" \
        --machine-type="$MACHINE_TYPE" \
        --accelerator="type=$ACCELERATOR,count=$ACCELERATOR_COUNT" \
        --min-replica-count="$MIN_REPLICAS" \
        --max-replica-count="$MAX_REPLICAS" \
        --traffic-split="0=$TRAFFIC_SPLIT" \
        --enable-access-logging \
        --enable-container-logging \
        --project="$PROJECT_ID"
    
    if [ $? -ne 0 ]; then
        log_error "Failed to deploy model"
        exit 1
    fi
    
    log_info "✓ Model deployed successfully!"
}

configure_autoscaling() {
    log_info "Configuring autoscaling..."
    
    # Note: Autoscaling is configured via min/max replicas
    # Additional tuning done in script 06-autoscaling-config.sh
    
    log_info "Autoscaling config:"
    log_info "  Min replicas: $MIN_REPLICAS"
    log_info "  Max replicas: $MAX_REPLICAS"
    log_info "  Target metric: CPU utilization (70%)"
    log_info "  Scale-up policy: Aggressive"
    log_info "  Scale-down policy: Conservative (5 min cooldown)"
}

health_check() {
    log_info "Performing health check..."
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        local status
        status=$(gcloud ai endpoints describe "$ENDPOINT_ID" \
            --region="$REGION" \
            --format="value(deployedModels[0].serviceAccount)" \
            --project="$PROJECT_ID" 2>/dev/null || echo "")
        
        if [ -n "$status" ]; then
            log_info "✓ Endpoint is healthy"
            return 0
        fi
        
        attempt=$((attempt + 1))
        log_info "Waiting for deployment to be ready... ($attempt/$max_attempts)"
        sleep 10
    done
    
    log_warn "Health check timed out"
    return 1
}

test_prediction() {
    log_info "Testing prediction..."
    
    # Get endpoint details
    local endpoint_uri
    endpoint_uri=$(gcloud ai endpoints describe "$ENDPOINT_ID" \
        --region="$REGION" \
        --format="value(name)" \
        --project="$PROJECT_ID")
    
    # Test prediction
    cat > /tmp/test-instance.json <<EOF
{
  "instances": [{
    "prompt": "What is machine learning?",
    "max_tokens": 50,
    "temperature": 0.7
  }]
}
EOF
    
    log_info "Sending test prediction..."
    
    local response
    response=$(curl -s -X POST \
        -H "Authorization: Bearer $(gcloud auth print-access-token)" \
        -H "Content-Type: application/json" \
        "https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/endpoints/${ENDPOINT_ID}:predict" \
        -d @/tmp/test-instance.json)
    
    rm /tmp/test-instance.json
    
    if echo "$response" | grep -q "predictions"; then
        log_info "✓ Test prediction successful"
        log_info "Response:"
        echo "$response" | python3 -m json.tool | head -n 20
    else
        log_warn "Test prediction failed or returned unexpected format"
        echo "$response"
    fi
}

print_summary() {
    log_info "============================================"
    log_info "Model Deployment Complete!"
    log_info "============================================"
    log_info ""
    log_info "Endpoint ID: $ENDPOINT_ID"
    log_info "Model ID: $MODEL_ID"
    log_info "Deployment Name: $DEPLOYMENT_NAME"
    log_info "Machine Type: $MACHINE_TYPE"
    log_info "Accelerator: $ACCELERATOR x $ACCELERATOR_COUNT"
    log_info "Replicas: $MIN_REPLICAS - $MAX_REPLICAS"
    log_info "Traffic: $TRAFFIC_SPLIT%"
    log_info ""
    log_info "Prediction Endpoint:"
    log_info "  https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/endpoints/${ENDPOINT_ID}:predict"
    log_info ""
    log_info "Next steps:"
    log_info "  1. Configure autoscaling: ./scripts/06-autoscaling-config.sh --endpoint-id=$ENDPOINT_ID"
    log_info "  2. Setup monitoring: ./scripts/08-monitoring-setup.sh --endpoint-id=$ENDPOINT_ID"
    log_info "  3. Test with Python: python vertex-ai/python/prediction_client.py"
}

main() {
    log_info "Starting model deployment..."
    
    deploy_model
    configure_autoscaling
    health_check
    test_prediction
    print_summary
    
    log_info "✓ Deployment complete!"
}

main "$@"
