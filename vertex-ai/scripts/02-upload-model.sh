#!/bin/bash
# =============================================================================
# 02-upload-model.sh - Upload model to Vertex AI Model Registry
# =============================================================================

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# Configuration
# =============================================================================

PROJECT_ID="${PROJECT_ID:-}"
REGION="${REGION:-us-central1}"
MODEL_PATH=""
MODEL_NAME=""
MODEL_VERSION=""
FRAMEWORK="tensorflow"  # tensorflow, pytorch, sklearn, custom
CONTAINER_IMAGE=""
DESCRIPTION=""

# =============================================================================
# Parse Arguments
# =============================================================================

usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Upload a model to Vertex AI Model Registry

OPTIONS:
    --model-path=PATH       Path to model artifacts (GCS or local)
    --model-name=NAME       Model display name
    --version=VERSION       Model version (e.g., v1.0.0)
    --framework=FRAMEWORK   Model framework (tensorflow|pytorch|sklearn|custom)
    --container=IMAGE       Custom container image (optional)
    --description=TEXT      Model description (optional)

EXAMPLES:
    # Upload TensorFlow SavedModel
    $0 --model-path=gs://bucket/model --model-name=gpt-4o --version=v1.0 --framework=tensorflow

    # Upload PyTorch model
    $0 --model-path=./model --model-name=bert --version=v2.0 --framework=pytorch

    # Upload custom model with container
    $0 --model-path=gs://bucket/model --model-name=custom-llm --version=v1.0 \
       --framework=custom --container=gcr.io/project/image:latest
EOF
    exit 1
}

for arg in "$@"; do
    case $arg in
        --model-path=*)
            MODEL_PATH="${arg#*=}"
            shift
            ;;
        --model-name=*)
            MODEL_NAME="${arg#*=}"
            shift
            ;;
        --version=*)
            MODEL_VERSION="${arg#*=}"
            shift
            ;;
        --framework=*)
            FRAMEWORK="${arg#*=}"
            shift
            ;;
        --container=*)
            CONTAINER_IMAGE="${arg#*=}"
            shift
            ;;
        --description=*)
            DESCRIPTION="${arg#*=}"
            shift
            ;;
        --help)
            usage
            ;;
        *)
            log_error "Unknown option: $arg"
            usage
            ;;
    esac
done

# Validate required parameters
if [ -z "$MODEL_PATH" ] || [ -z "$MODEL_NAME" ] || [ -z "$MODEL_VERSION" ]; then
    log_error "Missing required parameters"
    usage
fi

# =============================================================================
# Functions
# =============================================================================

validate_model_path() {
    log_info "Validating model path..."
    
    if [[ "$MODEL_PATH" == gs://* ]]; then
        # GCS path
        if ! gsutil ls "$MODEL_PATH" &>/dev/null; then
            log_error "Model path not found: $MODEL_PATH"
            exit 1
        fi
    elif [ -d "$MODEL_PATH" ]; then
        # Local path - upload to GCS
        local bucket="${PROJECT_ID}-vertex-ai-models"
        local gcs_path="gs://${bucket}/models/${MODEL_NAME}/${MODEL_VERSION}"
        
        log_info "Uploading model to GCS: $gcs_path"
        gsutil -m rsync -r "$MODEL_PATH" "$gcs_path"
        MODEL_PATH="$gcs_path"
    else
        log_error "Invalid model path: $MODEL_PATH"
        exit 1
    fi
    
    log_info "Model path validated: $MODEL_PATH"
}

get_prebuilt_container() {
    local framework=$1
    local container=""
    
    case $framework in
        tensorflow)
            container="us-docker.pkg.dev/vertex-ai/prediction/tf2-gpu.2-12:latest"
            ;;
        pytorch)
            container="us-docker.pkg.dev/vertex-ai/prediction/pytorch-gpu.1-13:latest"
            ;;
        sklearn)
            container="us-docker.pkg.dev/vertex-ai/prediction/sklearn-cpu.1-0:latest"
            ;;
        *)
            log_error "Unsupported framework: $framework"
            exit 1
            ;;
    esac
    
    echo "$container"
}

upload_model() {
    log_info "Uploading model to Vertex AI..."
    
    # Determine container image
    if [ -z "$CONTAINER_IMAGE" ]; then
        CONTAINER_IMAGE=$(get_prebuilt_container "$FRAMEWORK")
    fi
    
    log_info "Using container: $CONTAINER_IMAGE"
    
    # Create model metadata
    local display_name="${MODEL_NAME}-${MODEL_VERSION}"
    local artifact_uri="$MODEL_PATH"
    
    # Upload model
    local model_id
    model_id=$(gcloud ai models upload \
        --region="$REGION" \
        --display-name="$display_name" \
        --description="$DESCRIPTION" \
        --artifact-uri="$artifact_uri" \
        --container-image-uri="$CONTAINER_IMAGE" \
        --container-health-route="/health" \
        --container-predict-route="/predict" \
        --container-ports=8080 \
        --version-aliases="$MODEL_VERSION,latest" \
        --format="value(model)" \
        --project="$PROJECT_ID" 2>&1 | grep -oP 'models/\K[0-9]+' | head -n1)
    
    if [ -z "$model_id" ]; then
        log_error "Failed to upload model"
        exit 1
    fi
    
    log_info "✓ Model uploaded successfully!"
    log_info "Model ID: $model_id"
    
    # Add labels
    gcloud ai models update "$model_id" \
        --region="$REGION" \
        --update-labels="framework=$FRAMEWORK,version=$MODEL_VERSION,name=$MODEL_NAME" \
        --project="$PROJECT_ID" &>/dev/null || true
    
    echo "$model_id"
}

create_model_version() {
    log_info "Creating model version..."
    
    # Check if model already exists
    local existing_model
    existing_model=$(gcloud ai models list \
        --region="$REGION" \
        --filter="displayName:$MODEL_NAME" \
        --format="value(name)" \
        --project="$PROJECT_ID" | head -n1)
    
    if [ -n "$existing_model" ]; then
        log_info "Adding version to existing model: $existing_model"
        
        # Upload new version
        gcloud ai models upload \
            --region="$REGION" \
            --parent-model="$existing_model" \
            --display-name="${MODEL_NAME}-${MODEL_VERSION}" \
            --artifact-uri="$MODEL_PATH" \
            --container-image-uri="$CONTAINER_IMAGE" \
            --version-aliases="$MODEL_VERSION" \
            --project="$PROJECT_ID"
    else
        # Upload as new model
        upload_model
    fi
}

generate_model_card() {
    log_info "Generating model card..."
    
    local model_id=$1
    local card_path="/tmp/model-card-${MODEL_NAME}-${MODEL_VERSION}.md"
    
    cat > "$card_path" <<EOF
# Model Card: ${MODEL_NAME} ${MODEL_VERSION}

## Model Details
- **Model Name**: ${MODEL_NAME}
- **Version**: ${MODEL_VERSION}
- **Framework**: ${FRAMEWORK}
- **Upload Date**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
- **Model ID**: ${model_id}
- **Artifact URI**: ${MODEL_PATH}
- **Container**: ${CONTAINER_IMAGE}

## Model Description
${DESCRIPTION:-No description provided}

## Intended Use
- **Primary Use Cases**: [TODO: Add use cases]
- **Out-of-Scope Uses**: [TODO: Add out-of-scope uses]

## Training Data
- **Dataset**: [TODO: Add dataset info]
- **Size**: [TODO: Add size]
- **Preprocessing**: [TODO: Add preprocessing steps]

## Evaluation
- **Metrics**: [TODO: Add evaluation metrics]
- **Results**: [TODO: Add results]

## Ethical Considerations
- **Bias**: [TODO: Add bias analysis]
- **Fairness**: [TODO: Add fairness considerations]

## Deployment
- **Recommended Machine Type**: n1-standard-8
- **Recommended GPU**: NVIDIA T4
- **Min Replicas**: 2
- **Max Replicas**: 20
- **Target QPS**: 50 per replica

## Changelog
- **${MODEL_VERSION}**: Initial upload on $(date -u +"%Y-%m-%d")

EOF
    
    log_info "Model card saved: $card_path"
    
    # Upload to GCS
    local bucket="${PROJECT_ID}-vertex-ai-models"
    gsutil cp "$card_path" "gs://${bucket}/model-cards/${MODEL_NAME}/${MODEL_VERSION}.md"
    
    log_info "Model card uploaded to GCS"
}

print_summary() {
    local model_id=$1
    
    log_info "============================================"
    log_info "Model Upload Complete!"
    log_info "============================================"
    log_info ""
    log_info "Model Name: $MODEL_NAME"
    log_info "Version: $MODEL_VERSION"
    log_info "Model ID: $model_id"
    log_info "Framework: $FRAMEWORK"
    log_info "Artifact URI: $MODEL_PATH"
    log_info ""
    log_info "View in Console:"
    log_info "  https://console.cloud.google.com/vertex-ai/models/$model_id?project=$PROJECT_ID"
    log_info ""
    log_info "Next steps:"
    log_info "  1. Create endpoint: ./scripts/03-create-endpoint.sh"
    log_info "  2. Deploy model: ./scripts/04-deploy-model.sh --model-id=$model_id"
    log_info ""
    log_info "Export model ID:"
    echo "export MODEL_ID=\"$model_id\""
}

# =============================================================================
# Main
# =============================================================================

main() {
    log_info "Starting model upload..."
    log_info "Model: $MODEL_NAME $MODEL_VERSION"
    log_info "Framework: $FRAMEWORK"
    
    validate_model_path
    model_id=$(upload_model)
    generate_model_card "$model_id"
    print_summary "$model_id"
    
    log_info "✓ Model upload complete!"
}

main "$@"
