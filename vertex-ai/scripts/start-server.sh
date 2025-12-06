#!/bin/bash
# Start Vertex AI API Server
# This script starts the Express server for Vertex AI predictions

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if .env exists
if [ ! -f .env ]; then
    log_error ".env file not found!"
    log_info "Please create .env file with required variables:"
    echo ""
    echo "GOOGLE_CLOUD_PROJECT=your-project-id"
    echo "VERTEX_AI_REGION=us-central1"
    echo "VERTEX_AI_ENDPOINT_ID=your-endpoint-id"
    echo "GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json"
    echo "VITE_API_URL=http://localhost:3001"
    exit 1
fi

# Source environment variables
source .env

# Check required variables
if [ -z "${GOOGLE_CLOUD_PROJECT:-}" ]; then
    log_error "GOOGLE_CLOUD_PROJECT is not set in .env"
    exit 1
fi

if [ -z "${VERTEX_AI_ENDPOINT_ID:-}" ]; then
    log_error "VERTEX_AI_ENDPOINT_ID is not set in .env"
    exit 1
fi

log_info "Starting Vertex AI API Server..."
log_info "Project: $GOOGLE_CLOUD_PROJECT"
log_info "Region: ${VERTEX_AI_REGION:-us-central1}"
log_info "Endpoint: $VERTEX_AI_ENDPOINT_ID"
echo ""

# Compile TypeScript and run server
npx tsx vertex-ai/server/api-server.ts
