#!/bin/bash
# Vertex AI IAM Setup Script
# Sets up service accounts, roles, and permissions for Vertex AI deployment

set -euo pipefail

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-observability-hub-prod}"
REGION="${VERTEX_AI_REGION:-us-central1}"
SERVICE_ACCOUNT_NAME="vertex-ai-predictor"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    log_error "gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Set project
log_info "Setting project to: $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

# Enable required APIs
log_info "Enabling required Google Cloud APIs..."
gcloud services enable \
    aiplatform.googleapis.com \
    compute.googleapis.com \
    storage-api.googleapis.com \
    logging.googleapis.com \
    monitoring.googleapis.com \
    cloudtrace.googleapis.com \
    cloudbuild.googleapis.com \
    containerregistry.googleapis.com \
    artifactregistry.googleapis.com

log_info "APIs enabled successfully"

# Create service account
log_info "Creating service account: $SERVICE_ACCOUNT_NAME"
if gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" &> /dev/null; then
    log_warn "Service account already exists: $SERVICE_ACCOUNT_EMAIL"
else
    gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
        --display-name="Vertex AI Prediction Service Account" \
        --description="Service account for Vertex AI online predictions and model deployment"
    log_info "Service account created: $SERVICE_ACCOUNT_EMAIL"
fi

# Grant IAM roles to service account
log_info "Granting IAM roles to service account..."

# Core Vertex AI roles
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/aiplatform.user" \
    --condition=None

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/aiplatform.serviceAgent" \
    --condition=None

# Storage access for model artifacts
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/storage.objectViewer" \
    --condition=None

# Logging and monitoring
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/logging.logWriter" \
    --condition=None

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/monitoring.metricWriter" \
    --condition=None

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/cloudtrace.agent" \
    --condition=None

log_info "IAM roles granted successfully"

# Create custom role for prediction-only access
log_info "Creating custom prediction-only role..."

cat > /tmp/vertex-ai-predictor-role.yaml <<EOF
title: "Vertex AI Predictor"
description: "Custom role for prediction-only access to Vertex AI endpoints"
stage: "GA"
includedPermissions:
- aiplatform.endpoints.predict
- aiplatform.endpoints.get
- aiplatform.endpoints.list
- aiplatform.models.get
- aiplatform.models.list
- logging.logEntries.create
- monitoring.timeSeries.create
EOF

# Check if custom role exists
if gcloud iam roles describe vertexAIPredictor --project="$PROJECT_ID" &> /dev/null; then
    log_warn "Custom role already exists, updating..."
    gcloud iam roles update vertexAIPredictor \
        --project="$PROJECT_ID" \
        --file=/tmp/vertex-ai-predictor-role.yaml
else
    gcloud iam roles create vertexAIPredictor \
        --project="$PROJECT_ID" \
        --file=/tmp/vertex-ai-predictor-role.yaml
    log_info "Custom role created: vertexAIPredictor"
fi

rm /tmp/vertex-ai-predictor-role.yaml

# Create service account key for local development
log_info "Creating service account key for local development..."
KEY_FILE="vertex-ai-service-account-key.json"

if [ -f "$KEY_FILE" ]; then
    log_warn "Key file already exists: $KEY_FILE (skipping)"
else
    gcloud iam service-accounts keys create "$KEY_FILE" \
        --iam-account="$SERVICE_ACCOUNT_EMAIL"
    log_info "Service account key created: $KEY_FILE"
    log_warn "⚠️  IMPORTANT: Store this key securely and never commit it to version control!"
    echo "export GOOGLE_APPLICATION_CREDENTIALS=\"\$(pwd)/$KEY_FILE\"" >> .env.vertex-ai
fi

# Set up workload identity for GKE (if using Kubernetes)
log_info "Setting up Workload Identity binding..."
KUBERNETES_SA="vertex-ai-predictor"
KUBERNETES_NAMESPACE="default"

gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/iam.workloadIdentityUser" \
    --member="serviceAccount:${PROJECT_ID}.svc.id.goog[${KUBERNETES_NAMESPACE}/${KUBERNETES_SA}]" \
    || log_warn "Workload Identity binding failed (skip if not using GKE)"

# Create storage bucket for model artifacts
BUCKET_NAME="${PROJECT_ID}-vertex-ai-models"
log_info "Creating storage bucket: gs://$BUCKET_NAME"

if gsutil ls "gs://$BUCKET_NAME" &> /dev/null; then
    log_warn "Bucket already exists: gs://$BUCKET_NAME"
else
    gsutil mb -p "$PROJECT_ID" -c STANDARD -l "$REGION" "gs://$BUCKET_NAME"
    
    # Set lifecycle policy to delete old model artifacts after 90 days
    cat > /tmp/lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 90}
      }
    ]
  }
}
EOF
    gsutil lifecycle set /tmp/lifecycle.json "gs://$BUCKET_NAME"
    rm /tmp/lifecycle.json
    
    log_info "Bucket created with 90-day lifecycle policy"
fi

# Grant bucket access to service account
gsutil iam ch "serviceAccount:${SERVICE_ACCOUNT_EMAIL}:roles/storage.objectAdmin" \
    "gs://$BUCKET_NAME"

# Summary
log_info "========================================="
log_info "✅ Vertex AI IAM Setup Complete!"
log_info "========================================="
echo ""
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Service Account: $SERVICE_ACCOUNT_EMAIL"
echo "Storage Bucket: gs://$BUCKET_NAME"
echo ""
echo "Next steps:"
echo "1. Source environment variables: source .env.vertex-ai"
echo "2. Deploy a model: ./scripts/02-deploy-model.sh"
echo "3. Create endpoint: ./scripts/03-create-endpoint.sh"
echo ""
log_warn "Remember to secure your service account key file!"
