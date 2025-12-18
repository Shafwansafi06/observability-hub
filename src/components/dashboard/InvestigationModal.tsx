import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, AlertTriangle, Sparkles, Copy, Check } from "lucide-react";
import { aiClient } from "@/lib/ai-client";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  title: string;
  description: string;
  severity: string;
  detection_rule_id?: string;
  threshold_value?: number;
  current_value?: number;
  recommendation?: string;
  metadata?: Record<string, any>;
}

interface InvestigationModalProps {
  alert: Alert | null;
  open: boolean;
  onClose: () => void;
  onResolve: (alertId: string, analysis: string) => Promise<void>;
}

export function InvestigationModal({ alert, open, onClose, onResolve }: InvestigationModalProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleAnalyze = async () => {
    if (!alert) return;

    setAnalyzing(true);
    setAnalysis("");

    // Rate limiting: Add delay between requests
    const lastRequestTime = localStorage.getItem('lastAIRequestTime');
    const now = Date.now();
    if (lastRequestTime) {
      const timeSinceLastRequest = now - parseInt(lastRequestTime);
      const minDelay = 2000; // 2 seconds minimum between requests
      if (timeSinceLastRequest < minDelay) {
        await new Promise(resolve => setTimeout(resolve, minDelay - timeSinceLastRequest));
      }
    }
    localStorage.setItem('lastAIRequestTime', now.toString());

    try {
      // Simplified prompt to reduce token usage and timeout risk
      const prompt = `Analyze this LLM observability alert and provide fix recommendations:

Alert: ${alert.title}
Rule: ${alert.detection_rule_id || 'N/A'}
Issue: ${alert.description}
Severity: ${alert.severity}
Value: ${alert.current_value} (threshold: ${alert.threshold_value})

Provide:
1. Root Cause (2-3 sentences)
2. Impact (2-3 sentences)
3. Fix Steps (3-5 bullet points)
4. Prevention (2-3 bullet points)
5. Code Example (if applicable)

Be concise and actionable.`;

      // Retry logic with exponential backoff
      let retries = 3;
      let lastError: Error | null = null;
      
      while (retries > 0) {
        try {
          const response = await Promise.race([
            aiClient.generate({
              prompt,
              model: 'gemini-2.5-flash', // Use Flash for faster response
              temperature: 0.3,
              maxTokens: 1500,
            }),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout after 30s')), 30000)
            )
          ]);

          setAnalysis(response.text);
          return; // Success!
        } catch (error: any) {
          lastError = error;
          retries--;
          
          if (retries > 0) {
            // Wait before retry (exponential backoff)
            const delay = (4 - retries) * 2000; // 2s, 4s, 6s
            console.log(`Retry in ${delay}ms... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // All retries failed
      throw lastError;
    } catch (error: any) {
      console.error('Analysis error:', error);
      const errorMessage = error?.message || 'Unknown error';
      setAnalysis(`❌ **Analysis Failed**

**Error:** ${errorMessage}

**Possible Solutions:**
1. The AI service might be rate-limited. Wait 30 seconds and try again.
2. The request timed out. Try again with a simpler alert.
3. Check your API key configuration in .env file.

**Manual Recommendations for ${alert.detection_rule_id}:**
${alert.recommendation || 'Review the alert details and consult documentation.'}

**Quick Fixes:**
- For high latency: Optimize model selection, reduce token limits
- For toxicity: Implement content filtering, review safety settings
- For hallucination: Add fact-checking, use retrieval augmentation
- For cost spikes: Set budget limits, use smaller models`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleResolve = async () => {
    if (!alert) return;

    setResolving(true);
    try {
      await onResolve(alert.id, analysis);
      setResolved(true);
      setTimeout(() => {
        onClose();
        setResolved(false);
        setAnalysis("");
      }, 2000);
    } catch (error) {
      console.error('Resolve error:', error);
    } finally {
      setResolving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(analysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setAnalysis("");
    setResolved(false);
    onClose();
  };

  if (!alert) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-Powered Investigation
          </DialogTitle>
          <DialogDescription>
            Using Gemini 2.5 Pro to analyze and provide fix recommendations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Alert Summary */}
          <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{alert.title}</h3>
              <Badge variant={alert.severity === "critical" ? "destructive" : "default"}>
                {alert.severity}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{alert.description}</p>
            {alert.detection_rule_id && (
              <div className="flex items-center gap-4 text-xs">
                <span className="text-muted-foreground">Rule: <span className="font-mono text-foreground">{alert.detection_rule_id}</span></span>
                {alert.current_value !== undefined && alert.threshold_value !== undefined && (
                  <span className="text-muted-foreground">
                    Value: <span className={cn("font-mono font-semibold", alert.severity === "critical" ? "text-destructive" : "text-yellow-500")}>
                      {alert.current_value.toFixed(2)}
                    </span> / {alert.threshold_value}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Analysis Section */}
          {!analysis && !analyzing && (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Click "Analyze with AI" to get expert recommendations
              </p>
              <Button onClick={handleAnalyze} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Analyze with AI
              </Button>
            </div>
          )}

          {analyzing && (
            <div className="text-center py-12">
              <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
              <p className="text-foreground font-medium">Analyzing with Gemini 2.5 Pro...</p>
              <p className="text-sm text-muted-foreground mt-2">
                This may take a few seconds
              </p>
            </div>
          )}

          {analysis && !resolved && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">AI Analysis & Recommendations</h3>
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
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
              <ScrollArea className="h-[400px] rounded-lg border border-border p-4 bg-muted/20">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-foreground font-sans">
                    {analysis}
                  </pre>
                </div>
              </ScrollArea>
            </>
          )}

          {resolved && (
            <div className="text-center py-12">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <p className="text-xl font-semibold text-foreground">Alert Resolved!</p>
              <p className="text-sm text-muted-foreground mt-2">
                The alert has been marked as resolved with AI analysis
              </p>
            </div>
          )}

          {/* Actions */}
          {analysis && !resolved && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={handleResolve} disabled={resolving} className="gap-2">
                {resolving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Resolving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Mark as Resolved
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
