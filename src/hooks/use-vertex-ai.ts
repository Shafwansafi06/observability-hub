/**
 * React Hook for Vertex AI Predictions
 * Provides easy-to-use hooks for LLM inference in React components
 */

import { useState, useCallback } from 'react';
import { getVertexAIClient, PredictionRequest, PredictionResponse } from '@/lib/vertex-ai-client';

export interface UsePredictionOptions {
  onSuccess?: (response: PredictionResponse) => void;
  onError?: (error: Error) => void;
}

export function useVertexAIPrediction(options?: UsePredictionOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<PredictionResponse | null>(null);

  const predict = useCallback(
    async (request: PredictionRequest) => {
      setLoading(true);
      setError(null);

      try {
        const client = getVertexAIClient();
        const response = await client.predict(request);
        setData(response);
        options?.onSuccess?.(response);
        return response;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Prediction failed');
        setError(error);
        options?.onError?.(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return {
    predict,
    loading,
    error,
    data,
    reset,
  };
}

export interface UseStreamingPredictionOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export function useVertexAIStream(options?: UseStreamingPredictionOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const predictStream = useCallback(
    async (request: PredictionRequest) => {
      setLoading(true);
      setIsStreaming(true);
      setError(null);
      setText('');

      try {
        const client = getVertexAIClient();
        
        for await (const chunk of client.predictStream(request)) {
          setText((prev) => {
            const newText = prev + chunk;
            options?.onChunk?.(chunk);
            return newText;
          });
        }

        options?.onComplete?.();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Streaming failed');
        setError(error);
        options?.onError?.(error);
        throw error;
      } finally {
        setLoading(false);
        setIsStreaming(false);
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setIsStreaming(false);
    setError(null);
    setText('');
  }, []);

  const stop = useCallback(() => {
    setIsStreaming(false);
    setLoading(false);
  }, []);

  return {
    predictStream,
    loading,
    isStreaming,
    error,
    text,
    reset,
    stop,
  };
}
