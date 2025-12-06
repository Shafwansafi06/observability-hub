#!/bin/bash
# Deploy Model to Vertex AI
# Uploads and registers a model in Vertex AI Model Registry

set -euo pipefail

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-observability-hub-prod}"
REGION="${VERTEX_AI_REGION:-us-central1}"
MODEL_NAME="${1:-llm-gpt4-turbo}"
MODEL_VERSION="${2:-v1}"
DISPLAY_NAME="${MODEL_NAME}-${MODEL_VERSION}"
CONTAINER_IMAGE="${3:-gcr.io/${PROJECT_ID}/vertex-ai-predictor:latest}"
ARTIFACT_URI="${4:-gs://${PROJECT_ID}-vertex-ai-models/${MODEL_NAME}/${MODEL_VERSION}}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Validate inputs
if [ -z "$MODEL_NAME" ]; then
    log_error "Usage: $0 <model-name> [model-version] [container-image] [artifact-uri]"
    exit 1
fi

log_info "========================================="
log_info "Deploying Model to Vertex AI"
log_info "========================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Model Name: $MODEL_NAME"
echo "Version: $MODEL_VERSION"
echo "Display Name: $DISPLAY_NAME"
echo "Container: $CONTAINER_IMAGE"
echo "Artifacts: $ARTIFACT_URI"
echo ""

# Check if model artifacts exist
log_info "Checking if model artifacts exist..."
if ! gsutil ls "$ARTIFACT_URI" &> /dev/null; then
    log_warn "Model artifacts not found at: $ARTIFACT_URI"
    log_info "Creating sample model directory..."
    echo '{"model": "placeholder"}' | gsutil cp - "${ARTIFACT_URI}/model.json"
fi

# Upload model to Vertex AI
log_info "Uploading model to Vertex AI Model Registry..."

# Create model configuration
cat > /tmp/model-config.json <<EOF
{
  "displayName": "$DISPLAY_NAME",
  "description": "LLM model for inference - $MODEL_NAME $MODEL_VERSION",
  "containerSpec": {
    "imageUri": "$CONTAINER_IMAGE",
    "ports": [{"containerPort": 8080}],
    "healthRoute": "/health",
    "predictRoute": "/predict",
    "env": [
      {"name": "MODEL_NAME", "value": "$MODEL_NAME"},
      {"name": "MODEL_VERSION", "value": "$MODEL_VERSION"},
      {"name": "AIP_STORAGE_URI", "value": "$ARTIFACT_URI"}
    ]
  },
  "artifactUri": "$ARTIFACT_URI",
  "labels": {
    "model_name": "$MODEL_NAME",
    "model_version": "$MODEL_VERSION",
    "environment": "production",
    "framework": "pytorch"
  }
}
EOF

# Upload model using gcloud
MODEL_ID=$(gcloud ai models upload \
    --region="$REGION" \
    --display-name="$DISPLAY_NAME" \
    --container-image-uri="$CONTAINER_IMAGE" \
    --artifact-uri="$ARTIFACT_URI" \
    --container-health-route="/health" \
    --container-predict-route="/predict" \
    --container-ports=8080 \
    --description="LLM model: $MODEL_NAME $MODEL_VERSION" \
    --format="value(model)" 2>&1 | grep -oP "projects/[^']+/models/\K[0-9]+")

if [ -z "$MODEL_ID" ]; then
    log_error "Failed to upload model"
    exit 1
fi

log_info "✅ Model uploaded successfully!"
echo "Model ID: $MODEL_ID"
echo "Model Resource Name: projects/$PROJECT_ID/locations/$REGION/models/$MODEL_ID"

# Add metadata labels
log_info "Adding metadata labels to model..."
gcloud ai models update "$MODEL_ID" \
    --region="$REGION" \
    --update-labels="model_name=$MODEL_NAME,model_version=$MODEL_VERSION,environment=production"

# List model versions
log_info "Listing all versions of model: $MODEL_NAME"
gcloud ai models list \
    --region="$REGION" \
    --filter="labels.model_name=$MODEL_NAME" \
    --format="table(name,displayName,createTime,labels)"

# Save model information
cat > ".vertex-ai-model-${MODEL_NAME}-${MODEL_VERSION}.json" <<EOF
{
  "model_id": "$MODEL_ID",
  "model_name": "$MODEL_NAME",
  "model_version": "$MODEL_VERSION",
  "display_name": "$DISPLAY_NAME",
  "region": "$REGION",
  "container_image": "$CONTAINER_IMAGE",
  "artifact_uri": "$ARTIFACT_URI",
  "resource_name": "projects/$PROJECT_ID/locations/$REGION/models/$MODEL_ID",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

log_info "Model information saved to: .vertex-ai-model-${MODEL_NAME}-${MODEL_VERSION}.json"

# Cleanup
rm /tmp/model-config.json

log_info "========================================="
log_info "✅ Model Deployment Complete!"
log_info "========================================="
echo ""
echo "Next steps:"
echo "1. Create endpoint: ./scripts/03-create-endpoint.sh"
echo "2. Deploy model to endpoint: ./scripts/04-deploy-to-endpoint.sh $MODEL_ID"
echo ""
