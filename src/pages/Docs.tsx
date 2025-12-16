import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Code, 
  BookOpen, 
  Zap, 
  Brain, 
  Shield, 
  Rocket, 
  Database,
  GitBranch,
  Terminal,
  LineChart,
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

const Docs = () => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const CodeBlock = ({ code, language = 'typescript', id }: { code: string; language?: string; id: string }) => (
    <div className="relative group">
      <Button
        size="sm"
        variant="ghost"
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => copyToClipboard(code, id)}
      >
        {copiedCode === id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
      <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );

  const sections = [
    { id: 'quickstart', title: 'Quick Start', icon: Zap },
    { id: 'sdk', title: 'SDK Integration', icon: Code },
    { id: 'ml', title: 'ML Anomaly Detection', icon: Brain },
    { id: 'deployment', title: 'Deployment', icon: Rocket },
    { id: 'architecture', title: 'Architecture', icon: Database },
    { id: 'security', title: 'Security', icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar theme={theme} setTheme={setTheme} />
      
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-4" variant="secondary">
              <BookOpen className="h-3 w-3 mr-1" />
              Documentation
            </Badge>
            <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              ObservAI Documentation
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Complete guide to integrating, deploying, and optimizing your LLM observability platform
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button size="lg" asChild>
                <a href="#quickstart">
                  Get Started <ChevronRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="https://github.com/Shafwansafi06/observability-hub" target="_blank" rel="noopener noreferrer">
                  <GitBranch className="mr-2 h-4 w-4" />
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <aside className={`
            fixed lg:sticky top-20 left-0 h-[calc(100vh-5rem)] w-64 
            bg-background border-r lg:translate-x-0 transition-transform z-40
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}>
            <div className="p-4 flex justify-between items-center lg:hidden">
              <h3 className="font-semibold">Navigation</h3>
              <Button size="sm" variant="ghost" onClick={() => setSidebarOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="h-full pb-20">
              <nav className="space-y-1 p-4">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <section.icon className="h-4 w-4" />
                    {section.title}
                  </a>
                ))}
              </nav>
            </ScrollArea>
          </aside>

          {/* Mobile Menu Button */}
          <Button
            className="fixed bottom-4 right-4 lg:hidden z-50"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Main Content */}
          <main className="flex-1 min-w-0 lg:ml-0">
            <div className="max-w-4xl mx-auto space-y-16">
              
              {/* Quick Start */}
              <section id="quickstart" className="scroll-mt-20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-3xl font-bold">Quick Start</h2>
                </div>
                
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Get Started in 3 Steps</CardTitle>
                    <CardDescription>Set up ObservAI in under 5 minutes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Badge>1</Badge> Install the SDK
                      </h4>
                      <CodeBlock 
                        id="install"
                        code="npm install @observai/sdk @google/generative-ai"
                      />
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Badge>2</Badge> Initialize the Client
                      </h4>
                      <CodeBlock 
                        id="init"
                        code={`import { ObservAIClient } from '@observai/sdk';

const client = new ObservAIClient({
  apiKey: process.env.VERTEX_AI_API_KEY!,
  projectId: 'my-app',
  userId: 'user-123',
  trackingEndpoint: 'https://your-project.supabase.co/functions/v1/track-llm',
  batchMode: true, // Enable efficient batch tracking
});`}
                      />
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Badge>3</Badge> Start Tracking
                      </h4>
                      <CodeBlock 
                        id="usage"
                        code={`const result = await client.generateContent(
  'gemini-2.5-flash',
  'Explain quantum computing in simple terms'
);

console.log(result.response.text());
console.log('Cost:', result.tracking.cost_usd);
console.log('Quality:', result.tracking.coherence_score);`}
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 p-4 rounded">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    <AlertCircle className="inline h-4 w-4 mr-2" />
                    That's it! Every LLM request is now automatically tracked with quality analysis, cost calculation, and anomaly detection.
                  </p>
                </div>
              </section>

              {/* SDK Integration */}
              <section id="sdk" className="scroll-mt-20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Code className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-3xl font-bold">SDK Integration</h2>
                </div>

                <Tabs defaultValue="nodejs" className="mb-6">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="nodejs">Node.js</TabsTrigger>
                    <TabsTrigger value="nextjs">Next.js</TabsTrigger>
                    <TabsTrigger value="lambda">Lambda</TabsTrigger>
                    <TabsTrigger value="react">React</TabsTrigger>
                  </TabsList>

                  <TabsContent value="nodejs">
                    <Card>
                      <CardHeader>
                        <CardTitle>Express.js Integration</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CodeBlock 
                          id="nodejs"
                          code={`import { ObservAIClient } from '@observai/sdk';
import express from 'express';

const client = new ObservAIClient({
  apiKey: process.env.VERTEX_AI_API_KEY!,
  projectId: 'my-api',
  userId: 'api-user',
  trackingEndpoint: process.env.OBSERVAI_ENDPOINT!,
  batchMode: true,
});

app.post('/api/chat', async (req, res) => {
  const result = await client.generateContent(
    'gemini-2.5-flash',
    req.body.message,
    {
      sessionId: req.sessionID,
      metadata: {
        endpoint: '/api/chat',
        userAgent: req.headers['user-agent'],
      },
    }
  );

  res.json({
    response: result.response.text(),
    cost: result.tracking.cost_usd,
    quality: result.tracking.coherence_score,
  });
});`}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="nextjs">
                    <Card>
                      <CardHeader>
                        <CardTitle>Next.js App Router</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CodeBlock 
                          id="nextjs"
                          code={`// app/api/generate/route.ts
import { ObservAIClient } from '@observai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new ObservAIClient({
  apiKey: process.env.VERTEX_AI_API_KEY!,
  projectId: 'nextjs-app',
  userId: 'api-user',
  trackingEndpoint: process.env.OBSERVAI_ENDPOINT!,
  batchMode: true,
});

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();

  const result = await client.generateContent(
    'gemini-2.5-flash',
    prompt
  );

  return NextResponse.json({
    text: result.response.text(),
    tracking: result.tracking,
  });
}`}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="lambda">
                    <Card>
                      <CardHeader>
                        <CardTitle>AWS Lambda Function</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CodeBlock 
                          id="lambda"
                          code={`import { ObservAIClient } from '@observai/sdk';

const client = new ObservAIClient({
  apiKey: process.env.VERTEX_AI_API_KEY!,
  projectId: 'lambda-function',
  userId: 'lambda-user',
  trackingEndpoint: process.env.OBSERVAI_ENDPOINT!,
  batchMode: false, // Use immediate mode for Lambda
});

export const handler = async (event: any) => {
  try {
    const result = await client.generateContent(
      'gemini-2.5-flash',
      event.prompt
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        response: result.response.text(),
        cost: result.tracking.cost_usd,
      }),
    };
  } finally {
    await client.dispose(); // Cleanup before cold shutdown
  }
};`}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="react">
                    <Card>
                      <CardHeader>
                        <CardTitle>React Hook (Client-Side)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CodeBlock 
                          id="react"
                          code={`import { ObservAIClient } from '@observai/sdk';
import { useState, useCallback } from 'react';

const client = new ObservAIClient({
  apiKey: import.meta.env.VITE_VERTEX_AI_API_KEY!,
  projectId: 'react-app',
  userId: 'frontend-user',
  trackingEndpoint: import.meta.env.VITE_OBSERVAI_ENDPOINT!,
  batchMode: true,
});

export function useObservAI() {
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async (prompt: string) => {
    setLoading(true);
    try {
      const result = await client.generateContent(
        'gemini-2.5-flash',
        prompt
      );

      return {
        text: result.response.text(),
        cost: result.tracking.cost_usd,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  return { generate, loading };
}`}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                <Card>
                  <CardHeader>
                    <CardTitle>SDK Configuration Options</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-4">Parameter</th>
                            <th className="text-left py-2 px-4">Type</th>
                            <th className="text-left py-2 px-4">Required</th>
                            <th className="text-left py-2 px-4">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-mono text-xs">apiKey</td>
                            <td className="py-2 px-4">string</td>
                            <td className="py-2 px-4"><Badge variant="destructive">Yes</Badge></td>
                            <td className="py-2 px-4">Vertex AI API key</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-mono text-xs">projectId</td>
                            <td className="py-2 px-4">string</td>
                            <td className="py-2 px-4"><Badge variant="destructive">Yes</Badge></td>
                            <td className="py-2 px-4">Your project identifier</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-mono text-xs">userId</td>
                            <td className="py-2 px-4">string</td>
                            <td className="py-2 px-4"><Badge variant="destructive">Yes</Badge></td>
                            <td className="py-2 px-4">User/tenant identifier</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-mono text-xs">trackingEndpoint</td>
                            <td className="py-2 px-4">string</td>
                            <td className="py-2 px-4"><Badge variant="destructive">Yes</Badge></td>
                            <td className="py-2 px-4">ObservAI tracking endpoint</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-mono text-xs">batchMode</td>
                            <td className="py-2 px-4">boolean</td>
                            <td className="py-2 px-4"><Badge>No</Badge></td>
                            <td className="py-2 px-4">Enable batch tracking (default: false)</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-mono text-xs">batchSize</td>
                            <td className="py-2 px-4">number</td>
                            <td className="py-2 px-4"><Badge>No</Badge></td>
                            <td className="py-2 px-4">Max requests per batch (default: 10)</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-4 font-mono text-xs">batchWaitMs</td>
                            <td className="py-2 px-4">number</td>
                            <td className="py-2 px-4"><Badge>No</Badge></td>
                            <td className="py-2 px-4">Max wait time in ms (default: 3000)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* ML Anomaly Detection */}
              <section id="ml" className="scroll-mt-20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-3xl font-bold">ML Anomaly Detection</h2>
                </div>

                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Adaptive Learning System</CardTitle>
                    <CardDescription>
                      ObservAI learns what's normal for YOUR application, not generic thresholds
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className="font-semibold mb-3">How It Works</h4>
                      <div className="space-y-3">
                        <div className="flex gap-3">
                          <Badge className="h-6">1</Badge>
                          <div>
                            <p className="font-medium">Collect Historical Data</p>
                            <p className="text-sm text-muted-foreground">System analyzes last 24 hours of your LLM requests</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <Badge className="h-6">2</Badge>
                          <div>
                            <p className="font-medium">Compute Baselines</p>
                            <p className="text-sm text-muted-foreground">Calculates mean, stddev, and percentiles for each metric</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <Badge className="h-6">3</Badge>
                          <div>
                            <p className="font-medium">Detect Anomalies</p>
                            <p className="text-sm text-muted-foreground">Uses Z-score analysis (3+ stddev = 99.7% confidence)</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <Badge className="h-6">4</Badge>
                          <div>
                            <p className="font-medium">Auto-Tune</p>
                            <p className="text-sm text-muted-foreground">Recomputes baselines every 5 minutes, adapts to changes</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">Example Detection</h4>
                      <CodeBlock 
                        id="ml-example"
                        language="text"
                        code={`Your Normal Behavior (Learned):
├─ Latency: mean=850ms, stddev=120ms
└─ Cost: mean=$0.003, stddev=$0.0005

New Request Arrives:
├─ Latency: 3200ms
└─ Cost: $0.025

ML Detection:
├─ Latency Z-score: (3200 - 850) / 120 = 19.6
├─ Cost Z-score: (0.025 - 0.003) / 0.0005 = 44
└─ Result: 🚨 CRITICAL ANOMALY DETECTED

Alert Created:
├─ Latency: 3200ms (expected: 850ms, +276% deviation)
├─ Cost: $0.025 (expected: $0.003, +733% deviation)
└─ Confidence: 99.99%+`}
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Metrics Tracked</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Latency (response time)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Cost (per-request spending)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Token usage (input/output)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Coherence (quality score)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Toxicity (safety measure)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Hallucination risk</span>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Detection Methods</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        <li className="flex items-center gap-2">
                          <LineChart className="h-4 w-4 text-blue-500" />
                          <span>Z-score analysis (statistical)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <LineChart className="h-4 w-4 text-blue-500" />
                          <span>IQR method (outlier detection)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <LineChart className="h-4 w-4 text-blue-500" />
                          <span>Percentile tracking (P95, P99)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <LineChart className="h-4 w-4 text-blue-500" />
                          <span>Per-user baselines</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <LineChart className="h-4 w-4 text-blue-500" />
                          <span>Automatic threshold tuning</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <LineChart className="h-4 w-4 text-blue-500" />
                          <span>Multi-metric correlation</span>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </section>

              {/* Deployment */}
              <section id="deployment" className="scroll-mt-20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Rocket className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-3xl font-bold">Deployment Guide</h2>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <Card>
                    <CardHeader>
                      <Database className="h-8 w-8 text-green-500 mb-2" />
                      <CardTitle>Backend</CardTitle>
                      <CardDescription>Supabase</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm mb-4">PostgreSQL + Edge Functions</p>
                      <Badge>Free: 500MB</Badge>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <Rocket className="h-8 w-8 text-blue-500 mb-2" />
                      <CardTitle>Frontend</CardTitle>
                      <CardDescription>Vercel</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm mb-4">Zero-config deployment</p>
                      <Badge>Free: Unlimited</Badge>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <Terminal className="h-8 w-8 text-purple-500 mb-2" />
                      <CardTitle>SDK</CardTitle>
                      <CardDescription>NPM</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm mb-4">Package distribution</p>
                      <Badge>Free</Badge>
                    </CardContent>
                  </Card>
                </div>

                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Step-by-Step Deployment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className="font-semibold mb-2">1. Deploy Backend (Supabase)</h4>
                      <CodeBlock 
                        id="deploy-backend"
                        language="bash"
                        code={`# Install Supabase CLI
npm install -g supabase

# Login and link project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Apply database migrations
supabase db push

# Deploy edge functions
supabase functions deploy track-llm
supabase functions deploy adaptive-anomaly-detection

# Set secrets
supabase secrets set SUPABASE_URL="https://your-project.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"`}
                      />
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">2. Deploy Frontend (Vercel)</h4>
                      <CodeBlock 
                        id="deploy-frontend"
                        language="bash"
                        code={`# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Add environment variables in Vercel dashboard:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - VITE_VERTEX_AI_API_KEY`}
                      />
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">3. Publish SDK (NPM)</h4>
                      <CodeBlock 
                        id="deploy-sdk"
                        language="bash"
                        code={`cd sdk
npm run build
npm login
npm publish --access public`}
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 p-4 rounded">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    <AlertCircle className="inline h-4 w-4 mr-2" />
                    Total cost to start: $0/month with free tiers from Supabase and Vercel
                  </p>
                </div>
              </section>

              {/* Architecture */}
              <section id="architecture" className="scroll-mt-20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Database className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-3xl font-bold">System Architecture</h2>
                </div>

                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Data Flow</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Badge className="min-w-[120px]">Your App</Badge>
                        <ChevronRight className="h-4 w-4" />
                        <Badge className="min-w-[120px]">ObservAI SDK</Badge>
                        <ChevronRight className="h-4 w-4" />
                        <Badge className="min-w-[120px]">Vertex AI</Badge>
                      </div>
                      <div className="flex items-center gap-4 pl-[136px]">
                        <ChevronRight className="h-4 w-4 rotate-90" />
                      </div>
                      <div className="flex items-center gap-4 pl-[136px]">
                        <Badge className="min-w-[120px]">Edge Function</Badge>
                        <ChevronRight className="h-4 w-4" />
                        <Badge className="min-w-[120px]">PostgreSQL</Badge>
                      </div>
                      <div className="flex items-center gap-4 pl-[136px]">
                        <ChevronRight className="h-4 w-4 rotate-90" />
                      </div>
                      <div className="flex items-center gap-4 pl-[136px]">
                        <Badge className="min-w-[120px]">ML Detector</Badge>
                        <ChevronRight className="h-4 w-4" />
                        <Badge className="min-w-[120px]">Dashboard</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Key Components</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        <li>
                          <strong>SDK Client:</strong> Auto-tracks all LLM requests
                        </li>
                        <li>
                          <strong>Quality Analyzer:</strong> Coherence, toxicity, hallucination detection
                        </li>
                        <li>
                          <strong>Cost Calculator:</strong> Real-time per-request cost
                        </li>
                        <li>
                          <strong>Batch Manager:</strong> Efficient data transmission
                        </li>
                        <li>
                          <strong>Edge Function:</strong> Data ingestion + validation
                        </li>
                        <li>
                          <strong>ML Detector:</strong> Adaptive anomaly detection
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Database Tables</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <Code className="h-3 w-3" />
                          <code>llm_requests</code> - All tracked requests
                        </li>
                        <li className="flex items-center gap-2">
                          <Code className="h-3 w-3" />
                          <code>user_baselines</code> - Learned normal behavior
                        </li>
                        <li className="flex items-center gap-2">
                          <Code className="h-3 w-3" />
                          <code>anomalies</code> - Detected anomalies
                        </li>
                        <li className="flex items-center gap-2">
                          <Code className="h-3 w-3" />
                          <code>alerts</code> - User notifications
                        </li>
                        <li className="flex items-center gap-2">
                          <Code className="h-3 w-3" />
                          <code>logs</code> - System logs
                        </li>
                        <li className="flex items-center gap-2">
                          <Code className="h-3 w-3" />
                          <code>cost_tracking</code> - Budget management
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </section>

              {/* Security */}
              <section id="security" className="scroll-mt-20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-3xl font-bold">Security & Compliance</h2>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Data Protection</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          Row Level Security (RLS)
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          Encrypted at rest
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          HTTPS only (TLS 1.3)
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          API key rotation support
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          Auto data sanitization
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Authentication</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          Email/Password auth
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          Google OAuth
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          JWT token management
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          Auto token refresh
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          Protected routes
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Compliance Ready</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <h4 className="font-semibold mb-2">GDPR</h4>
                        <p className="text-sm text-muted-foreground">Data export/deletion APIs</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">SOC 2</h4>
                        <p className="text-sm text-muted-foreground">Supabase is SOC 2 compliant</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Audit Logs</h4>
                        <p className="text-sm text-muted-foreground">Track all data access</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Open Source */}
              <section className="scroll-mt-20">
                <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <GitBranch className="h-6 w-6" />
                      <CardTitle>Open Source</CardTitle>
                    </div>
                    <CardDescription>
                      ObservAI is fully open source and free to use
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm">
                      Fork, customize, and deploy your own instance. Contribute back to help improve the platform for everyone.
                    </p>
                    <div className="flex gap-4">
                      <Button asChild>
                        <a href="https://github.com/Shafwansafi06/observability-hub" target="_blank" rel="noopener noreferrer">
                          <GitBranch className="mr-2 h-4 w-4" />
                          View on GitHub
                        </a>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link to="/dashboard">
                          Try Demo <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </section>

            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Docs;
