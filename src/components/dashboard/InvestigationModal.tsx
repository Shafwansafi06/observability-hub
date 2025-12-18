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

    try {
      const prompt = `You are an expert AI/ML engineer analyzing a critical alert in an LLM observability system.

**Alert Details:**
- Title: ${alert.title}
- Description: ${alert.description}
- Severity: ${alert.severity}
- Detection Rule: ${alert.detection_rule_id || 'N/A'}
- Threshold: ${alert.threshold_value || 'N/A'}
- Current Value: ${alert.current_value || 'N/A'}
- Recommendation: ${alert.recommendation || 'N/A'}

**Context:**
${JSON.stringify(alert.metadata || {}, null, 2)}

**Your Task:**
Provide a comprehensive analysis and actionable fix recommendations in the following format:

## 🔍 Root Cause Analysis
[Explain what caused this alert to trigger]

## ⚠️ Impact Assessment
[Describe the potential impact on the system]

## 🛠️ Fix Recommendations
[Provide 3-5 specific, actionable steps to fix this issue]

## 📊 Prevention Strategies
[Suggest ways to prevent this issue in the future]

## 💡 Code Examples
[If applicable, provide code snippets or configuration changes]

Be specific, technical, and actionable. Focus on practical solutions.`;

      const response = await aiClient.generate({
        prompt,
        model: 'gemini-2.5-pro',
        temperature: 0.3,
        maxTokens: 2048,
      });

      setAnalysis(response.text);
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysis('❌ Failed to analyze the alert. Please try again.');
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
