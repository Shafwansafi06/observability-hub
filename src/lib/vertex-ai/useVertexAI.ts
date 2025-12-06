import { useState, useCallback } from 'react';
import { vertexAI, PredictionRequest, PredictionResponse, VertexAIMetrics } from './client';

export interface UseVertexAIReturn {
  predict: (request: PredictionRequest) => Promise<PredictionResponse>;
  predictStream: (request: PredictionRequest, onChunk: (text: string) => void) => Promise<void>;
  analyzeAnomalies: (logs: string[]) => Promise<{
    anomalies: Array<{
      log: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      explanation: string;
    }>;
    summary: string;
  }>;
  getLLMMetrics: () => Promise<{
    latencyP50: number;
    latencyP95: number;
    latencyP99: number;
    throughput: number;
    errorRate: number;
    tokenUsage: number;
  }>;
  loading: boolean;
  error: string | null;
  metrics: VertexAIMetrics;
  clearError: () => void;
}

export function useVertexAI(): UseVertexAIReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<VertexAIMetrics>(vertexAI.getMetrics());

  const updateMetrics = useCallback(() => {
    setMetrics(vertexAI.getMetrics());
  }, []);

  const predict = useCallback(async (request: PredictionRequest): Promise<PredictionResponse> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await vertexAI.predict(request);
      updateMetrics();
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Prediction failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [updateMetrics]);

  const predictStream = useCallback(async (
    request: PredictionRequest,
    onChunk: (text: string) => void
  ): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      for await (const chunk of vertexAI.predictStream(request)) {
        onChunk(chunk);
      }
      updateMetrics();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stream prediction failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [updateMetrics]);

  const analyzeAnomalies = useCallback(async (logs: string[]) => {
    setLoading(true);
    setError(null);

    try {
      const result = await vertexAI.analyzeAnomalies(logs);
      updateMetrics();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Anomaly analysis failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [updateMetrics]);

  const getLLMMetrics = useCallback(async () => {
    try {
      return await vertexAI.getLLMMetrics();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get metrics';
      setError(message);
      throw err;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    predict,
    predictStream,
    analyzeAnomalies,
    getLLMMetrics,
    loading,
    error,
    metrics,
    clearError,
  };
}

export default useVertexAI;
