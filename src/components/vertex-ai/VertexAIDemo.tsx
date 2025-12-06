/**
 * Example React Component using Vertex AI
 * Demonstrates how to integrate LLM predictions in a Vite + React app
 */

import { useState } from 'react';
import { useVertexAIPrediction, useVertexAIStream } from '@/hooks/use-vertex-ai';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, Zap } from 'lucide-react';

export function VertexAIDemo() {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'batch' | 'stream'>('batch');

  // Batch prediction
  const { predict, loading: batchLoading, error: batchError, data: batchData } = useVertexAIPrediction({
    onSuccess: (response) => {
      console.log('Prediction successful:', response);
    },
  });

  // Streaming prediction
  const { predictStream, loading: streamLoading, text: streamText, error: streamError } = useVertexAIStream({
    onChunk: (chunk) => {
      console.log('Received chunk:', chunk);
    },
    onComplete: () => {
      console.log('Streaming complete');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) return;

    const request = {
      prompt,
      max_tokens: 1000,
      temperature: 0.7,
      user_id: 'demo-user',
      session_id: crypto.randomUUID(),
    };

    try {
      if (mode === 'batch') {
        await predict(request);
      } else {
        await predictStream(request);
      }
    } catch (error) {
      console.error('Prediction failed:', error);
    }
  };

  const loading = mode === 'batch' ? batchLoading : streamLoading;
  const error = mode === 'batch' ? batchError : streamError;
  const response = mode === 'batch' ? batchData?.prediction?.text : streamText;

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Vertex AI - LLM Inference Demo
          </CardTitle>
          <CardDescription>
            Test Vertex AI predictions with batch or streaming mode
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Selection */}
          <div className="flex gap-2">
            <Button
              variant={mode === 'batch' ? 'default' : 'outline'}
              onClick={() => setMode('batch')}
              disabled={loading}
            >
              <Zap className="mr-2 h-4 w-4" />
              Batch Mode
            </Button>
            <Button
              variant={mode === 'stream' ? 'default' : 'outline'}
              onClick={() => setMode('stream')}
              disabled={loading}
            >
              <Loader2 className="mr-2 h-4 w-4" />
              Streaming Mode
            </Button>
          </div>

          {/* Prompt Input */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Enter your prompt
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Explain quantum computing in simple terms..."
                rows={4}
                disabled={loading}
                className="w-full"
              />
            </div>

            <Button type="submit" disabled={loading || !prompt.trim()} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === 'stream' ? 'Streaming...' : 'Generating...'}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Response
                </>
              )}
            </Button>
          </form>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          {/* Response Display */}
          {response && (
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-lg">Response</CardTitle>
                {mode === 'batch' && batchData?.metadata && (
                  <CardDescription>
                    Latency: {batchData.metadata.latency}ms | 
                    Model: {batchData.metadata.modelDisplayName || 'Vertex AI'}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  {response}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">API Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Mode</p>
              <p className="font-medium capitalize">{mode}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium">{loading ? 'Processing' : 'Ready'}</p>
            </div>
            {mode === 'batch' && batchData?.requestId && (
              <div className="col-span-2">
                <p className="text-muted-foreground">Request ID</p>
                <p className="font-mono text-xs">{batchData.requestId}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
