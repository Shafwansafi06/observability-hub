#!/bin/bash
# =============================================================================
# 05-traffic-split.sh - Manage traffic splitting for blue-green deployment
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
BLUE_DEPLOYMENT_ID=""
GREEN_DEPLOYMENT_ID=""
BLUE_TRAFFIC=0
GREEN_TRAFFIC=0
GRADUAL=false
MONITOR_INTERVAL=300  # 5 minutes

usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Manage traffic splitting between blue and green deployments

OPTIONS:
    --endpoint-id=ID          Endpoint ID (required)
    --blue-deployment=ID      Blue deployment ID (required)
    --green-deployment=ID     Green deployment ID (required)
    --blue-traffic=PERCENT    Blue traffic percentage (0-100)
    --green-traffic=PERCENT   Green traffic percentage (0-100)
    --gradual                 Gradually shift traffic (10% → 100%)
    --monitor-interval=SEC    Monitoring interval for gradual shift (default: 300s)

EXAMPLES:
    # Shift 10% traffic to green deployment
    $0 --endpoint-id=123 --blue-deployment=abc --green-deployment=def \
       --blue-traffic=90 --green-traffic=10

    # Gradual rollout (10% → 25% → 50% → 100%)
    $0 --endpoint-id=123 --blue-deployment=abc --green-deployment=def \
       --green-traffic=100 --gradual

    # Full cutover to green
    $0 --endpoint-id=123 --blue-deployment=abc --green-deployment=def \
       --blue-traffic=0 --green-traffic=100

EOF
    exit 1
}

for arg in "$@"; do
    case $arg in
        --endpoint-id=*) ENDPOINT_ID="${arg#*=}"; shift ;;
        --blue-deployment=*) BLUE_DEPLOYMENT_ID="${arg#*=}"; shift ;;
        --green-deployment=*) GREEN_DEPLOYMENT_ID="${arg#*=}"; shift ;;
        --blue-traffic=*) BLUE_TRAFFIC="${arg#*=}"; shift ;;
        --green-traffic=*) GREEN_TRAFFIC="${arg#*=}"; shift ;;
        --gradual) GRADUAL=true; shift ;;
        --monitor-interval=*) MONITOR_INTERVAL="${arg#*=}"; shift ;;
        --help) usage ;;
        *) log_error "Unknown option: $arg"; usage ;;
    esac
done

if [ -z "$ENDPOINT_ID" ] || [ -z "$BLUE_DEPLOYMENT_ID" ] || [ -z "$GREEN_DEPLOYMENT_ID" ]; then
    log_error "Missing required parameters"
    usage
fi

# Validate traffic percentages
total=$((BLUE_TRAFFIC + GREEN_TRAFFIC))
if [ $total -ne 100 ]; then
    log_error "Traffic percentages must sum to 100 (got $total)"
    exit 1
fi

get_deployment_metrics() {
    local deployment_id=$1
    local metric_type=$2  # error_rate, latency_p95, qps
    
    # Get metrics from Cloud Monitoring
    gcloud monitoring time-series list \
        --filter="resource.type=aiplatform.googleapis.com/Endpoint \
                  AND resource.labels.endpoint_id=${ENDPOINT_ID} \
                  AND resource.labels.deployed_model_id=${deployment_id} \
                  AND metric.type=aiplatform.googleapis.com/prediction/${metric_type}" \
        --format="value(points[0].value.doubleValue)" \
        --project="$PROJECT_ID" 2>/dev/null | head -n1 || echo "0"
}

check_deployment_health() {
    local deployment_id=$1
    local deployment_name=$2
    
    log_info "Checking health of $deployment_name deployment..."
    
    # Get metrics
    local error_rate latency qps
    error_rate=$(get_deployment_metrics "$deployment_id" "error_count")
    latency=$(get_deployment_metrics "$deployment_id" "latency")
    qps=$(get_deployment_metrics "$deployment_id" "prediction_count")
    
    log_info "  Error rate: ${error_rate}%"
    log_info "  P95 Latency: ${latency}ms"
    log_info "  QPS: $qps"
    
    # Check thresholds
    local healthy=true
    if (( $(echo "$error_rate > 1.0" | bc -l) )); then
        log_error "  ✗ Error rate too high: ${error_rate}% (threshold: 1%)"
        healthy=false
    fi
    
    if (( $(echo "$latency > 500" | bc -l) )); then
        log_warn "  ⚠ Latency high: ${latency}ms (threshold: 500ms)"
    fi
    
    if [ "$healthy" = true ]; then
        log_info "  ✓ Deployment is healthy"
        return 0
    else
        log_error "  ✗ Deployment is unhealthy"
        return 1
    fi
}

update_traffic_split() {
    local blue_pct=$1
    local green_pct=$2
    
    log_info "Updating traffic split: Blue=$blue_pct% Green=$green_pct%"
    
    # Update traffic split
    gcloud ai endpoints update-traffic-split "$ENDPOINT_ID" \
        --region="$REGION" \
        --traffic-split="${BLUE_DEPLOYMENT_ID}=${blue_pct},${GREEN_DEPLOYMENT_ID}=${green_pct}" \
        --project="$PROJECT_ID"
    
    if [ $? -ne 0 ]; then
        log_error "Failed to update traffic split"
        return 1
    fi
    
    log_info "✓ Traffic split updated"
    return 0
}

gradual_rollout() {
    log_info "Starting gradual rollout to green deployment..."
    
    local stages=(10 25 50 75 100)
    local durations=(3600 14400 43200 86400 0)  # 1h, 4h, 12h, 24h
    
    for i in "${!stages[@]}"; do
        local green_pct=${stages[$i]}
        local blue_pct=$((100 - green_pct))
        local duration=${durations[$i]}
        
        log_info "============================================"
        log_info "Stage $((i + 1)): Shifting to ${green_pct}% green traffic"
        log_info "============================================"
        
        # Check green deployment health before proceeding
        if ! check_deployment_health "$GREEN_DEPLOYMENT_ID" "green"; then
            log_error "Green deployment is unhealthy. Aborting rollout."
            log_error "Rolling back to previous traffic split..."
            if [ $i -gt 0 ]; then
                local prev_stage=${stages[$((i - 1))]}
                update_traffic_split $((100 - prev_stage)) $prev_stage
            else
                update_traffic_split 100 0
            fi
            exit 1
        fi
        
        # Update traffic split
        if ! update_traffic_split $blue_pct $green_pct; then
            log_error "Failed to update traffic. Aborting."
            exit 1
        fi
        
        # Monitor for duration
        if [ $duration -gt 0 ]; then
            log_info "Monitoring for $((duration / 60)) minutes..."
            log_info "Checking metrics every $((MONITOR_INTERVAL / 60)) minutes"
            
            local elapsed=0
            while [ $elapsed -lt $duration ]; do
                sleep $MONITOR_INTERVAL
                elapsed=$((elapsed + MONITOR_INTERVAL))
                
                log_info "Elapsed: $((elapsed / 60))/$((duration / 60)) minutes"
                
                # Check health periodically
                if ! check_deployment_health "$GREEN_DEPLOYMENT_ID" "green"; then
                    log_error "Health check failed during monitoring. Rolling back..."
                    if [ $i -gt 0 ]; then
                        local prev_stage=${stages[$((i - 1))]}
                        update_traffic_split $((100 - prev_stage)) $prev_stage
                    else
                        update_traffic_split 100 0
                    fi
                    exit 1
                fi
            done
        fi
    done
    
    log_info "✓ Gradual rollout complete!"
    log_info "Green deployment now serving 100% of traffic"
}

print_current_split() {
    log_info "Current traffic split:"
    
    gcloud ai endpoints describe "$ENDPOINT_ID" \
        --region="$REGION" \
        --format="table(
            deployedModels.id,
            deployedModels.displayName,
            deployedModels.dedicatedResources.minReplicaCount,
            deployedModels.dedicatedResources.maxReplicaCount,
            trafficSplit
        )" \
        --project="$PROJECT_ID"
}

main() {
    log_info "Traffic Split Manager"
    log_info "Endpoint: $ENDPOINT_ID"
    
    print_current_split
    
    if [ "$GRADUAL" = true ]; then
        gradual_rollout
    else
        # Direct traffic split
        if ! check_deployment_health "$GREEN_DEPLOYMENT_ID" "green"; then
            log_error "Green deployment is unhealthy. Aborting traffic shift."
            exit 1
        fi
        
        update_traffic_split $BLUE_TRAFFIC $GREEN_TRAFFIC
    fi
    
    log_info ""
    log_info "============================================"
    log_info "Traffic Split Updated!"
    log_info "============================================"
    print_current_split
    
    log_info ""
    log_info "Monitor traffic:"
    log_info "  https://console.cloud.google.com/vertex-ai/endpoints/$ENDPOINT_ID?project=$PROJECT_ID"
}

main "$@"
