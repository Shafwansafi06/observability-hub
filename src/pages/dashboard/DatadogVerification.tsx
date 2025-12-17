import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  RefreshCw,
  AlertTriangle,
  Send,
  Activity,
} from 'lucide-react';
import { datadogRum } from '@datadog/browser-rum';
import { datadogLogs } from '@datadog/browser-logs';
import { useToast } from '@/hooks/use-toast';

interface DatadogStatus {
  rum: { initialized: boolean; sessionId: string | null };
  logs: { initialized: boolean };
  env: {
    applicationId: string;
    service: string;
    env: string;
    version: string;
    site: string;
  };
}

export default function DatadogVerification() {
  const [status, setStatus] = useState<DatadogStatus | null>(null);
  const [testResults, setTestResults] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    checkDatadogStatus();
  }, []);

  const checkDatadogStatus = () => {
    // Check RUM
    const rumSessionId = datadogRum.getInternalContext()?.session_id || null;
    const rumInitialized = !!import.meta.env.VITE_DD_APPLICATION_ID && !!import.meta.env.VITE_DD_CLIENT_TOKEN;

    // Check Logs
    const logsInitialized = !!import.meta.env.VITE_DD_CLIENT_TOKEN;

    setStatus({
      rum: {
        initialized: rumInitialized,
        sessionId: rumSessionId,
      },
      logs: {
        initialized: logsInitialized,
      },
      env: {
        applicationId: import.meta.env.VITE_DD_APPLICATION_ID || 'NOT_SET',
        service: import.meta.env.VITE_DD_SERVICE || 'observai-frontend',
        env: import.meta.env.VITE_DD_ENV || 'production',
        version: import.meta.env.VITE_DD_VERSION || '1.0.0',
        site: import.meta.env.VITE_DD_SITE || 'datadoghq.com',
      },
    });
  };

  const sendTestLog = () => {
    const timestamp = new Date().toISOString();
    datadogLogs.logger.info('🧪 Test Log from ObservAI Verification Page', {
      test_type: 'manual',
      timestamp,
      user_action: 'verification_page',
      service: 'observai-hub',
    });

    setTestResults(prev => [...prev, { type: 'log', timestamp, status: 'sent' }]);
    toast({
      title: 'Test Log Sent',
      description: 'Check Datadog Logs Explorer in ~10 seconds',
    });
  };

  const sendTestRUMEvent = () => {
    const timestamp = new Date().toISOString();
    datadogRum.addAction('test_verification_action', {
      test_type: 'manual',
      timestamp,
      page: 'datadog_verification',
    });

    setTestResults(prev => [...prev, { type: 'rum_action', timestamp, status: 'sent' }]);
    toast({
      title: 'Test RUM Event Sent',
      description: 'Check Datadog RUM in ~5 seconds',
    });
  };

  const sendTestError = () => {
    const timestamp = new Date().toISOString();
    const testError = new Error('🧪 Test Error from ObservAI Verification');
    
    datadogRum.addError(testError, {
      test_type: 'manual',
      timestamp,
      page: 'datadog_verification',
    });

    datadogLogs.logger.error('🧪 Test Error Log', {
      test_type: 'manual',
      timestamp,
      error: testError.message,
    });

    setTestResults(prev => [...prev, { type: 'error', timestamp, status: 'sent' }]);
    toast({
      title: 'Test Error Sent',
      description: 'Check Datadog Errors in ~5 seconds',
      variant: 'destructive',
    });
  };

  if (!status) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Datadog Verification</h1>
        <p className="text-muted-foreground mt-2">
          Verify that ObservAI is sending data to Datadog correctly
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={status.rum.initialized ? 'border-green-500' : 'border-red-500'}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Datadog RUM</CardTitle>
              {status.rum.initialized ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
            </div>
            <CardDescription>Real User Monitoring</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={status.rum.initialized ? 'default' : 'destructive'}>
                {status.rum.initialized ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>
            {status.rum.sessionId && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Session ID:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {status.rum.sessionId.substring(0, 16)}...
                </code>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={status.logs.initialized ? 'border-green-500' : 'border-red-500'}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Datadog Logs</CardTitle>
              {status.logs.initialized ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
            </div>
            <CardDescription>Centralized Logging</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={status.logs.initialized ? 'default' : 'destructive'}>
                {status.logs.initialized ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Current Configuration</CardTitle>
          <CardDescription>Datadog environment variables</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">Application ID:</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                {status.env.applicationId}
              </code>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Service:</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block">
                {status.env.service}
              </code>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Environment:</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block">
                {status.env.env}
              </code>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Version:</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block">
                {status.env.version}
              </code>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground mb-1">Datadog Site:</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block">
                {status.env.site}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Data Sending */}
      <Card>
        <CardHeader>
          <CardTitle>Send Test Data</CardTitle>
          <CardDescription>Verify data is reaching Datadog</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Activity className="h-4 w-4" />
            <AlertDescription>
              Click the buttons below to send test data to Datadog. Then check your Datadog dashboards to verify the data arrives.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button onClick={sendTestLog} variant="outline" className="w-full">
              <Send className="h-4 w-4 mr-2" />
              Send Test Log
            </Button>
            <Button onClick={sendTestRUMEvent} variant="outline" className="w-full">
              <Activity className="h-4 w-4 mr-2" />
              Send RUM Event
            </Button>
            <Button onClick={sendTestError} variant="outline" className="w-full">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Send Test Error
            </Button>
          </div>

          {testResults.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">Recent Test Sends:</p>
              {testResults.slice(-5).reverse().map((result, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {result.type}: {new Date(result.timestamp).toLocaleTimeString()}
                  </span>
                  <Badge variant="outline">{result.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>View Data in Datadog</CardTitle>
          <CardDescription>Direct links to your Datadog dashboards</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button variant="outline" asChild>
              <a 
                href={`https://app.${status.env.site}/logs?query=service:${status.env.service}`}
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Logs
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a 
                href={`https://app.${status.env.site}/rum/sessions?query=service:${status.env.service}`}
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View RUM Sessions
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a 
                href={`https://app.${status.env.site}/rum/error-tracking?query=service:${status.env.service}`}
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Errors
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a 
                href={`https://app.${status.env.site}/event/explorer?query=service:${status.env.service}`}
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Events
              </a>
            </Button>
          </div>

          <Alert>
            <AlertDescription className="text-sm">
              💡 <strong>Tip:</strong> Use the query filter <code className="bg-muted px-1 rounded">service:{status.env.service}</code> to see only ObservAI data
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* What to Look For */}
      <Card>
        <CardHeader>
          <CardTitle>What to Look For in Datadog</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">📊 RUM (Real User Monitoring)</h3>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
              <li>Active sessions with your session ID</li>
              <li>Page views and navigation events</li>
              <li>User interactions (clicks, form submissions)</li>
              <li>Performance metrics (page load time, Core Web Vitals)</li>
              <li>Custom actions from Detection Demo</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">📝 Logs</h3>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
              <li>Application logs with <code>service:observai-frontend</code></li>
              <li>Detection rule triggers with <code>detection.rule_id</code> tags</li>
              <li>Error logs from frontend exceptions</li>
              <li>Console logs (errors and warnings)</li>
              <li>Test logs you send from this page</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">⚠️ Errors</h3>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
              <li>JavaScript errors with stack traces</li>
              <li>Network errors (failed API calls)</li>
              <li>Console errors forwarded automatically</li>
              <li>Test errors from this verification page</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">🚨 Detection Alerts</h3>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
              <li>Look for <code>detection_rule_triggered</code> in RUM Actions</li>
              <li>Search logs for <code>detection.rule_id:*</code></li>
              <li>Check Events for alert notifications</li>
              <li>Filter by severity: <code>detection.severity:critical</code></li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
