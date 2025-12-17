import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  DollarSign, 
  Shield, 
  ShieldAlert, 
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  TrendingUp,
} from 'lucide-react';
import { DEMO_SCENARIOS, DETECTION_RULES, type DetectionResult } from '@/lib/datadog-detection';
import { runDetectionAndPersist } from './useDetectionEngine';
import { aiClient } from '@/lib/ai-client';
import { useToast } from '@/hooks/use-toast';

const RULE_ICONS = {
  'LLM-001': AlertTriangle,
  'COST-001': DollarSign,
  'SEC-002': Shield,
  'LLM-002': ShieldAlert,
  'LLM-007': Clock,
};

const SEVERITY_COLORS = {
  critical: 'destructive',
  warning: 'destructive',
  info: 'default',
} as const;

export default function DetectionDemo() {
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [detectionResults, setDetectionResults] = useState<DetectionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string>('');
  const { toast } = useToast();

  const handleRunScenario = async (scenarioKey: string) => {
    const scenario = DEMO_SCENARIOS[scenarioKey as keyof typeof DEMO_SCENARIOS];
    setLoading(true);
    setActiveScenario(scenarioKey);
    setDetectionResults([]);
    setResponse('');

    try {
      // Call AI with the demo prompt
      const startTime = Date.now();
      const scenarioModel = 'model' in scenario ? scenario.model : undefined;
      const aiResponse = await aiClient.generate({
        prompt: scenario.prompt,
        model: (scenarioModel as any) || 'gemini-2.5-flash',
        temperature: 0.7,
        maxTokens: 2048,
      });
      
      const latency = Date.now() - startTime;
      setResponse(aiResponse.text);

      // Calculate cost (rough estimate)
      const cost = (aiResponse.tokens / 1000000) * 0.075; // $0.075 per 1M tokens for Flash

      // Run detection
      const results = await runDetectionAndPersist({
        prompt: scenario.prompt,
        response: aiResponse.text,
        model: aiResponse.model,
        tokens: aiResponse.tokens,
        cost: cost,
        latency: latency,
        ...scenario.expectedMetrics,
        userId: 'demo-user',
        requestId: `demo-${Date.now()}`,
      });

      setDetectionResults(results);

      if (results.length > 0) {
        toast({
          title: '🚨 Detection Rules Triggered!',
          description: `${results.length} rule(s) violated. Check Datadog for alerts.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: '✅ No Violations Detected',
          description: 'All metrics within acceptable thresholds.',
        });
      }

    } catch (error: any) {
      console.error('Demo scenario error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to run demo scenario',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Detection Rules Demo</h1>
        <p className="text-muted-foreground mt-2">
          Trigger Datadog detection rules and see real-time alerts in action
        </p>
      </div>

      {/* Info Banner */}
      <Alert>
        <TrendingUp className="h-4 w-4" />
        <AlertDescription>
          Each scenario triggers specific detection rules. Alerts are sent to Datadog in real-time with full context and recommendations.
          <a 
            href="https://app.datadoghq.com/logs" 
            target="_blank" 
            rel="noopener noreferrer"
            className="ml-2 inline-flex items-center text-primary hover:underline"
          >
            View in Datadog <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="scenarios" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scenarios">Demo Scenarios</TabsTrigger>
          <TabsTrigger value="rules">Detection Rules</TabsTrigger>
        </TabsList>

        {/* Demo Scenarios Tab */}
        <TabsContent value="scenarios" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(DEMO_SCENARIOS).map(([key, scenario]) => {
              const Icon = RULE_ICONS[scenario.expectedRule as keyof typeof RULE_ICONS];
              const isActive = activeScenario === key;
              
              return (
                <Card key={key} className={isActive ? 'border-primary' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Icon className="h-6 w-6 text-primary" />
                      {isActive && loading && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    <CardTitle className="text-lg">{scenario.name}</CardTitle>
                    <CardDescription>{scenario.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm">
                      <p className="font-medium text-foreground mb-1">Triggers:</p>
                      <Badge variant="outline">{scenario.expectedRule}</Badge>
                    </div>
                    
                    <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded">
                      <p className="font-mono line-clamp-3">{scenario.prompt}</p>
                    </div>

                    <Button 
                      onClick={() => handleRunScenario(key)}
                      disabled={loading}
                      className="w-full"
                      variant={isActive ? 'default' : 'outline'}
                    >
                      {loading && isActive ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Run Demo
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Detection Results */}
          {detectionResults.length > 0 && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Detection Results ({detectionResults.length})
                </CardTitle>
                <CardDescription>
                  Alerts have been sent to Datadog with full context
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {detectionResults.map((result, index) => {
                  const Icon = RULE_ICONS[result.ruleId as keyof typeof RULE_ICONS];
                  const rule = DETECTION_RULES[result.ruleId];
                  
                  return (
                    <Alert key={index} variant={SEVERITY_COLORS[result.severity]}>
                      <Icon className="h-4 w-4" />
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{result.ruleName}</p>
                            <p className="text-sm text-muted-foreground">{rule.description}</p>
                          </div>
                          <Badge variant={SEVERITY_COLORS[result.severity]}>
                            {result.severity.toUpperCase()}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Value:</span>
                            <span className="ml-2 font-mono font-semibold">{result.value.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Threshold:</span>
                            <span className="ml-2 font-mono">{result.threshold}</span>
                          </div>
                        </div>

                        <div className="bg-muted/50 p-3 rounded text-sm">
                          <p className="font-medium mb-1">Recommended Action:</p>
                          <p className="text-muted-foreground">{result.recommendation}</p>
                        </div>

                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Model: {result.context.model}</p>
                          <p>Tokens: {result.context.tokens} | Cost: ${result.context.cost?.toFixed(4)} | Latency: {result.context.latency}ms</p>
                          <p>Timestamp: {new Date(result.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    </Alert>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* AI Response */}
          {response && (
            <Card>
              <CardHeader>
                <CardTitle>AI Response</CardTitle>
                <CardDescription>Generated response from Gemini</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 w-full rounded border p-4">
                  <p className="text-sm whitespace-pre-wrap">{response}</p>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Detection Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(DETECTION_RULES).map((rule) => {
              const Icon = RULE_ICONS[rule.id as keyof typeof RULE_ICONS];
              const triggered = detectionResults.some(r => r.ruleId === rule.id);
              
              return (
                <Card key={rule.id} className={triggered ? 'border-destructive' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{rule.name}</CardTitle>
                          <Badge variant="outline" className="mt-1">{rule.id}</Badge>
                        </div>
                      </div>
                      {triggered ? (
                        <XCircle className="h-5 w-5 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{rule.description}</p>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Severity</p>
                        <Badge variant={SEVERITY_COLORS[rule.severity]} className="mt-1">
                          {rule.severity}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Category</p>
                        <p className="font-medium capitalize mt-1">{rule.category}</p>
                      </div>
                    </div>

                    <div className="text-sm">
                      <p className="text-muted-foreground mb-1">Threshold</p>
                      <p className="font-mono font-semibold">{rule.threshold}</p>
                    </div>

                    <div className="bg-muted/30 p-3 rounded text-sm">
                      <p className="font-medium mb-1">Action</p>
                      <p className="text-muted-foreground">{rule.action}</p>
                    </div>

                    {triggered && (
                      <Badge variant="destructive" className="w-full justify-center">
                        Currently Triggered
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle>Datadog Integration Status</CardTitle>
          <CardDescription>Real-time monitoring and alerting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm">Datadog RUM Connected</span>
            </div>
            <Badge variant="outline">Active</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm">Datadog Logs Connected</span>
            </div>
            <Badge variant="outline">Active</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm">Detection Engine Initialized</span>
            </div>
            <Badge variant="outline">Ready</Badge>
          </div>
          
          <div className="pt-3 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              View alerts in Datadog:
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="https://app.datadoghq.com/logs" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-2" />
                  Logs
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="https://app.datadoghq.com/rum/sessions" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-2" />
                  RUM
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="https://app.datadoghq.com/event/explorer" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-2" />
                  Events
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
