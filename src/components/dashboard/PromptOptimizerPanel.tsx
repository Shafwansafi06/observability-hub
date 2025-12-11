/**
 * Prompt Optimization Panel
 * Helps engineers improve their prompts based on Datadog metrics
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Sparkles, 
  TrendingDown, 
  TrendingUp, 
  Zap, 
  DollarSign, 
  Clock,
  Target,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Copy,
  RefreshCw
} from 'lucide-react';
import { PromptOptimizer, type PromptAnalysis, type OptimizationResult } from '@/lib/prompt-optimizer';

interface PromptOptimizerPanelProps {
  initialAnalysis?: PromptAnalysis | null;
}

export function PromptOptimizerPanel({ initialAnalysis }: PromptOptimizerPanelProps) {
  const [analysis, setAnalysis] = useState<PromptAnalysis | null>(initialAnalysis || null);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'DETAIL' | 'BASIC'>('DETAIL');
  const [copied, setCopied] = useState(false);

  // Update analysis when new data comes from Live AI Tester
  useEffect(() => {
    if (initialAnalysis) {
      setAnalysis(initialAnalysis);
      setOptimization(null); // Reset optimization when new prompt is tested
    }
  }, [initialAnalysis]);

  // Sample analysis for demo
  const useSampleData = () => {
    setAnalysis({
      originalPrompt: 'analyze this log',
      model: 'gemini-2.5-flash',
      tokensIn: 4,
      tokensOut: 1234,
      latency: 3456,
      cost: 0.000425,
      response: 'The log shows various errors...',
      coherenceScore: 0.65,
    });
  };

  const handleOptimize = async () => {
    if (!analysis) return;

    setLoading(true);
    try {
      const optimizer = new PromptOptimizer(mode, 'Gemini');
      const result = await optimizer.optimizePrompt(analysis);
      setOptimization(result);
    } catch (error) {
      console.error('Optimization failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getIssueIcon = (issue: string) => {
    if (issue.includes('high') || issue.includes('excessive')) {
      return <TrendingUp className="h-4 w-4 text-red-500" />;
    }
    if (issue.includes('low')) {
      return <TrendingDown className="h-4 w-4 text-yellow-500" />;
    }
    return <AlertCircle className="h-4 w-4 text-orange-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-blue-500/10">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-purple-500" />
            <div>
              <CardTitle className="text-2xl">Lyra - AI Prompt Optimizer</CardTitle>
              <CardDescription>
                Transform your prompts with data-driven insights from Datadog metrics
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Optimization Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'DETAIL' | 'BASIC')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="DETAIL">
                <Target className="h-4 w-4 mr-2" />
                DETAIL Mode
              </TabsTrigger>
              <TabsTrigger value="BASIC">
                <Zap className="h-4 w-4 mr-2" />
                BASIC Mode
              </TabsTrigger>
            </TabsList>
            <TabsContent value="DETAIL" className="mt-4">
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertDescription>
                  Comprehensive optimization with clarifying questions and detailed analysis
                </AlertDescription>
              </Alert>
            </TabsContent>
            <TabsContent value="BASIC" className="mt-4">
              <Alert>
                <Zap className="h-4 w-4" />
                <AlertDescription>
                  Quick optimization focusing on primary issues for immediate improvements
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Input Section */}
      {!analysis ? (
        <Card>
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>
              Load a prompt from your Datadog dashboard or use sample data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={useSampleData} variant="outline" className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Load Sample Analysis
            </Button>
            <div className="text-sm text-muted-foreground text-center">
              Or paste metrics from your LLM Metrics dashboard
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Current Analysis */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Current Performance</CardTitle>
                  <CardDescription>Metrics from your last LLM request</CardDescription>
                </div>
                <Badge variant="outline" className="bg-green-500/20 border-green-500/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Live Data
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Original Prompt */}
              <div>
                <label className="text-sm font-medium">Original Prompt:</label>
                <Textarea
                  value={analysis.originalPrompt}
                  onChange={(e) => setAnalysis({ ...analysis, originalPrompt: e.target.value })}
                  className="mt-2 font-mono text-sm"
                  rows={3}
                />
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-500/10 dark:bg-blue-500/20 p-4 rounded-lg border border-blue-500/20">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                    <Target className="h-4 w-4" />
                    <span className="text-xs font-medium">Input Tokens</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">{analysis.tokensIn}</div>
                  {analysis.tokensIn > 1000 && (
                    <Badge variant="destructive" className="mt-1 text-xs">High</Badge>
                  )}
                </div>

                <div className="bg-purple-500/10 dark:bg-purple-500/20 p-4 rounded-lg border border-purple-500/20">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs font-medium">Output Tokens</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">{analysis.tokensOut}</div>
                  {analysis.tokensOut > 2000 && (
                    <Badge variant="destructive" className="mt-1 text-xs">Verbose</Badge>
                  )}
                </div>

                <div className="bg-green-500/10 dark:bg-green-500/20 p-4 rounded-lg border border-green-500/20">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs font-medium">Latency</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">{analysis.latency}ms</div>
                  {analysis.latency > 3000 && (
                    <Badge variant="destructive" className="mt-1 text-xs">Slow</Badge>
                  )}
                </div>

                <div className="bg-yellow-500/10 dark:bg-yellow-500/20 p-4 rounded-lg border border-yellow-500/20">
                  <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-xs font-medium">Cost</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">${analysis.cost.toFixed(6)}</div>
                  {analysis.cost > 0.01 && (
                    <Badge variant="destructive" className="mt-1 text-xs">High</Badge>
                  )}
                </div>
              </div>

              {/* Quality Metrics */}
              {(analysis.coherenceScore || analysis.toxicityScore || analysis.hallucination_risk) && (
                <div className="border-t border-border pt-4">
                  <h4 className="text-sm font-medium text-foreground mb-3">Quality Metrics</h4>
                  <div className="grid grid-cols-3 gap-4">
                    {analysis.coherenceScore !== undefined && (
                      <div>
                        <div className="text-xs text-muted-foreground">Coherence</div>
                        <div className="text-lg font-bold text-foreground">{(analysis.coherenceScore * 100).toFixed(0)}%</div>
                      </div>
                    )}
                    {analysis.toxicityScore !== undefined && (
                      <div>
                        <div className="text-xs text-muted-foreground">Toxicity</div>
                        <div className="text-lg font-bold text-foreground">{(analysis.toxicityScore * 100).toFixed(0)}%</div>
                      </div>
                    )}
                    {analysis.hallucination_risk !== undefined && (
                      <div>
                        <div className="text-xs text-muted-foreground">Hallucination Risk</div>
                        <div className="text-lg font-bold text-foreground">{(analysis.hallucination_risk * 100).toFixed(0)}%</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Button 
                onClick={handleOptimize} 
                disabled={loading} 
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Optimizing with Lyra...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Optimize Prompt
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Optimization Results */}
          {optimization && (
            <Card className="border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground">Optimized Prompt</CardTitle>
                  <Badge variant="outline" className="bg-green-500/20 border-green-500/30">
                    {optimization.complexity} optimization
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Optimized Prompt */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-foreground">Your Improved Prompt:</label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(optimization.optimizedPrompt)}
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    value={optimization.optimizedPrompt}
                    readOnly
                    className="font-mono text-sm bg-background"
                    rows={6}
                  />
                </div>

                {/* Key Improvements */}
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Key Improvements:
                  </h4>
                  <ul className="space-y-2">
                    {optimization.improvements.map((improvement, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="text-green-500 mt-0.5">•</span>
                        <span>{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Expected Impact */}
                {Object.keys(optimization.expectedImprovements).length > 0 && (
                  <div className="grid grid-cols-3 gap-4 bg-muted/30 p-4 rounded-lg border border-border">
                    {optimization.expectedImprovements.tokenReduction && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Token Reduction</div>
                        <div className="text-lg font-bold text-green-500">
                          {optimization.expectedImprovements.tokenReduction}
                        </div>
                      </div>
                    )}
                    {optimization.expectedImprovements.costSavings && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Cost Savings</div>
                        <div className="text-lg font-bold text-green-500">
                          {optimization.expectedImprovements.costSavings}
                        </div>
                      </div>
                    )}
                    {optimization.expectedImprovements.clarityScore && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Clarity Boost</div>
                        <div className="text-lg font-bold text-green-500">
                          +{optimization.expectedImprovements.clarityScore}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Techniques Applied */}
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3">Techniques Applied:</h4>
                  <div className="flex flex-wrap gap-2">
                    {optimization.techniquesApplied.map((technique, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-green-500/20 border-green-500/30">
                        {technique}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Pro Tip */}
                <Alert className="bg-blue-500/10 border-blue-500/30">
                  <Lightbulb className="h-4 w-4 text-blue-500" />
                  <AlertDescription className="text-foreground">
                    <strong>Pro Tip:</strong> {optimization.proTip}
                  </AlertDescription>
                </Alert>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setAnalysis(null);
                      setOptimization(null);
                    }}
                  >
                    Optimize Another
                  </Button>
                  <Button 
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    onClick={() => copyToClipboard(optimization.optimizedPrompt)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy & Test in Live AI Tester
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
