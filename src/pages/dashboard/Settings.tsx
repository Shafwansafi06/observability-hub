import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Bell,
  Cloud,
  Key,
  Link,
  Mail,
  Moon,
  Save,
  Shield,
  Sun,
  User,
  Webhook,
} from "lucide-react";

interface SettingsProps {
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
}

const integrations = [
  {
    name: "Datadog",
    description: "Send metrics, logs, and traces",
    status: "connected",
    icon: "🐕",
  },
  {
    name: "Google Cloud",
    description: "Vertex AI and infrastructure",
    status: "connected",
    icon: "☁️",
  },
  {
    name: "Slack",
    description: "Alert notifications",
    status: "connected",
    icon: "💬",
  },
  {
    name: "PagerDuty",
    description: "Incident management",
    status: "disconnected",
    icon: "📟",
  },
];

export default function Settings({ theme, setTheme }: SettingsProps) {
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your ObservAI configuration and integrations
        </p>
      </div>

      {/* Appearance */}
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sun className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
            <p className="text-sm text-muted-foreground">
              Customize how ObservAI looks
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => setTheme("light")}
            className={cn(
              "flex-1 p-4 rounded-xl border-2 transition-all",
              theme === "light"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground"
            )}
          >
            <Sun className="h-6 w-6 mb-2 text-foreground" />
            <p className="font-medium text-foreground">Light</p>
            <p className="text-xs text-muted-foreground">
              Light mode for daytime use
            </p>
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={cn(
              "flex-1 p-4 rounded-xl border-2 transition-all",
              theme === "dark"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground"
            )}
          >
            <Moon className="h-6 w-6 mb-2 text-foreground" />
            <p className="font-medium text-foreground">Dark</p>
            <p className="text-xs text-muted-foreground">
              Dark mode for reduced eye strain
            </p>
          </button>
        </div>
      </section>

      {/* API Keys */}
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">API Keys</h2>
            <p className="text-sm text-muted-foreground">
              Manage your API credentials
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <p className="font-medium text-foreground">Datadog API Key</p>
              <p className="text-sm text-muted-foreground font-mono">
                ••••••••••••••••abcd
              </p>
            </div>
            <Button variant="outline" size="sm">
              Regenerate
            </Button>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <p className="font-medium text-foreground">Vertex AI Service Account</p>
              <p className="text-sm text-muted-foreground font-mono">
                observai-sa@project.iam.gserviceaccount.com
              </p>
            </div>
            <Button variant="outline" size="sm">
              Update
            </Button>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <Link className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Integrations</h2>
            <p className="text-sm text-muted-foreground">
              Connect external services
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="flex items-center justify-between p-4 rounded-lg border border-border"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{integration.icon}</span>
                <div>
                  <p className="font-medium text-foreground">{integration.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {integration.description}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "text-xs font-medium px-2.5 py-1 rounded-full",
                  integration.status === "connected"
                    ? "bg-accent/20 text-accent"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {integration.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Notifications */}
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
            <p className="text-sm text-muted-foreground">
              Configure alert channels
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { icon: Mail, label: "Email notifications", enabled: true },
            { icon: Webhook, label: "Webhook alerts", enabled: true },
            { icon: Bell, label: "Browser notifications", enabled: false },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between py-3 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">{item.label}</span>
              </div>
              <button
                className={cn(
                  "relative w-11 h-6 rounded-full transition-colors",
                  item.enabled ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                    item.enabled ? "left-6" : "left-1"
                  )}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button variant="default" size="lg">
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}
