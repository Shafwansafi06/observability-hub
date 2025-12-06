#!/bin/bash
# =============================================================================
# 01-setup-project.sh - Initialize GCP project for Vertex AI
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# Configuration
# =============================================================================

PROJECT_ID="${PROJECT_ID:-}"
REGION="${REGION:-us-central1}"
SERVICE_ACCOUNT_NAME="vertex-ai-inference"
BUCKET_NAME="${PROJECT_ID}-vertex-ai-models"

# =============================================================================
# Functions
# =============================================================================

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI not found. Install: https://cloud.google.com/sdk/install"
        exit 1
    fi
    
    if [ -z "$PROJECT_ID" ]; then
        log_error "PROJECT_ID not set. Run: export PROJECT_ID=your-project-id"
        exit 1
    fi
    
    log_info "Prerequisites check passed ✓"
}

enable_apis() {
    log_info "Enabling required APIs..."
    
    local apis=(
        "aiplatform.googleapis.com"           # Vertex AI
        "compute.googleapis.com"              # Compute Engine
        "storage.googleapis.com"              # Cloud Storage
        "logging.googleapis.com"              # Cloud Logging
        "monitoring.googleapis.com"           # Cloud Monitoring
        "cloudtrace.googleapis.com"           # Cloud Trace
        "cloudbuild.googleapis.com"           # Cloud Build
        "artifactregistry.googleapis.com"     # Artifact Registry
        "secretmanager.googleapis.com"        # Secret Manager
        "vpcaccess.googleapis.com"            # VPC Access
        "servicenetworking.googleapis.com"    # Service Networking
    )
    
    for api in "${apis[@]}"; do
        log_info "  Enabling $api..."
        gcloud services enable "$api" --project="$PROJECT_ID" 2>/dev/null || true
    done
    
    log_info "APIs enabled ✓"
}

create_service_account() {
    log_info "Creating service account..."
    
    local sa_email="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
    
    # Create service account
    if gcloud iam service-accounts describe "$sa_email" --project="$PROJECT_ID" &>/dev/null; then
        log_warn "Service account already exists: $sa_email"
    else
        gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
            --display-name="Vertex AI Inference Service Account" \
            --project="$PROJECT_ID"
        log_info "Created service account: $sa_email"
    fi
    
    # Grant IAM roles
    log_info "Granting IAM roles..."
    local roles=(
        "roles/aiplatform.user"
        "roles/storage.objectViewer"
        "roles/logging.logWriter"
        "roles/monitoring.metricWriter"
        "roles/cloudtrace.agent"
    )
    
    for role in "${roles[@]}"; do
        gcloud projects add-iam-policy-binding "$PROJECT_ID" \
            --member="serviceAccount:$sa_email" \
            --role="$role" \
            --condition=None \
            > /dev/null 2>&1
    done
    
    log_info "Service account configured ✓"
}

create_storage_bucket() {
    log_info "Creating Cloud Storage bucket..."
    
    if gsutil ls -b "gs://${BUCKET_NAME}" &>/dev/null; then
        log_warn "Bucket already exists: gs://${BUCKET_NAME}"
    else
        gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://${BUCKET_NAME}"
        
        # Enable versioning
        gsutil versioning set on "gs://${BUCKET_NAME}"
        
        # Set lifecycle policy (delete old versions after 30 days)
        cat > /tmp/lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [{
      "action": {"type": "Delete"},
      "condition": {
        "numNewerVersions": 3,
        "age": 30
      }
    }]
  }
}
EOF
        gsutil lifecycle set /tmp/lifecycle.json "gs://${BUCKET_NAME}"
        rm /tmp/lifecycle.json
        
        log_info "Created bucket: gs://${BUCKET_NAME}"
    fi
    
    log_info "Storage bucket configured ✓"
}

setup_networking() {
    log_info "Setting up networking..."
    
    # Create VPC if needed
    local vpc_name="vertex-ai-vpc"
    if ! gcloud compute networks describe "$vpc_name" --project="$PROJECT_ID" &>/dev/null; then
        gcloud compute networks create "$vpc_name" \
            --subnet-mode=auto \
            --project="$PROJECT_ID"
        log_info "Created VPC: $vpc_name"
    else
        log_warn "VPC already exists: $vpc_name"
    fi
    
    # Create firewall rules
    local firewall_rule="vertex-ai-allow-internal"
    if ! gcloud compute firewall-rules describe "$firewall_rule" --project="$PROJECT_ID" &>/dev/null; then
        gcloud compute firewall-rules create "$firewall_rule" \
            --network="$vpc_name" \
            --allow=tcp,udp,icmp \
            --source-ranges=10.0.0.0/8 \
            --project="$PROJECT_ID"
        log_info "Created firewall rule: $firewall_rule"
    else
        log_warn "Firewall rule already exists: $firewall_rule"
    fi
    
    log_info "Networking configured ✓"
}

configure_monitoring() {
    log_info "Configuring monitoring..."
    
    # Create notification channel for alerts
    local notification_channel_id
    notification_channel_id=$(gcloud alpha monitoring channels list \
        --filter="displayName='Vertex AI Alerts'" \
        --format="value(name)" \
        --project="$PROJECT_ID" 2>/dev/null | head -n1)
    
    if [ -z "$notification_channel_id" ]; then
        log_info "Creating email notification channel..."
        # Note: User should update this email
        cat > /tmp/channel.json <<EOF
{
  "type": "email",
  "displayName": "Vertex AI Alerts",
  "labels": {
    "email_address": "alerts@${PROJECT_ID}.iam.gserviceaccount.com"
  }
}
EOF
        gcloud alpha monitoring channels create \
            --channel-content-from-file=/tmp/channel.json \
            --project="$PROJECT_ID" &>/dev/null || true
        rm /tmp/channel.json
        log_warn "Update notification email in Cloud Console: Monitoring > Alerting > Notification Channels"
    fi
    
    log_info "Monitoring configured ✓"
}

create_artifact_registry() {
    log_info "Creating Artifact Registry..."
    
    local repo_name="vertex-ai-models"
    if ! gcloud artifacts repositories describe "$repo_name" \
        --location="$REGION" \
        --project="$PROJECT_ID" &>/dev/null; then
        
        gcloud artifacts repositories create "$repo_name" \
            --repository-format=docker \
            --location="$REGION" \
            --description="Vertex AI model containers" \
            --project="$PROJECT_ID"
        log_info "Created Artifact Registry: $repo_name"
    else
        log_warn "Artifact Registry already exists: $repo_name"
    fi
    
    log_info "Artifact Registry configured ✓"
}

print_summary() {
    log_info "============================================"
    log_info "Setup Complete!"
    log_info "============================================"
    log_info ""
    log_info "Project: $PROJECT_ID"
    log_info "Region: $REGION"
    log_info "Service Account: ${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
    log_info "Storage Bucket: gs://${BUCKET_NAME}"
    log_info "VPC Network: vertex-ai-vpc"
    log_info ""
    log_info "Next steps:"
    log_info "  1. Upload model: ./scripts/02-upload-model.sh"
    log_info "  2. Create endpoint: ./scripts/03-create-endpoint.sh"
    log_info "  3. Deploy model: ./scripts/04-deploy-model.sh"
    log_info ""
    log_info "Environment variables:"
    cat <<EOF
export PROJECT_ID="$PROJECT_ID"
export REGION="$REGION"
export VERTEX_AI_SA="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
export VERTEX_AI_BUCKET="gs://${BUCKET_NAME}"
EOF
}

# =============================================================================
# Main
# =============================================================================

main() {
    log_info "Starting Vertex AI project setup..."
    
    check_prerequisites
    enable_apis
    create_service_account
    create_storage_bucket
    setup_networking
    configure_monitoring
    create_artifact_registry
    print_summary
    
    log_info "✓ Project setup complete!"
}

# Run main function
main "$@"
