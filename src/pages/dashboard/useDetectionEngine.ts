// Shared detection engine hook for both DetectionDemo and LLMMetrics
import { detectionEngine } from '@/lib/datadog-detection';

export async function runDetectionAndPersist(metrics: any) {
  // Run detection and persist anomalies
  return detectionEngine.detectAnomalies(metrics);
}
