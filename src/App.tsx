import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Overview from "./pages/dashboard/Overview";
import LLMMetrics from "./pages/dashboard/LLMMetrics";
import LogStream from "./pages/dashboard/LogStream";
import Anomalies from "./pages/dashboard/Anomalies";
import Settings from "./pages/dashboard/Settings";

const queryClient = new QueryClient();

const App = () => {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index theme={theme} setTheme={setTheme} />} />
            
            {/* Dashboard Routes */}
            <Route
              path="/dashboard"
              element={<DashboardLayout theme={theme} setTheme={setTheme} />}
            >
              <Route index element={<Overview />} />
              <Route path="llm-metrics" element={<LLMMetrics />} />
              <Route path="log-stream" element={<LogStream />} />
              <Route path="anomalies" element={<Anomalies />} />
              <Route path="settings" element={<Settings theme={theme} setTheme={setTheme} />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
