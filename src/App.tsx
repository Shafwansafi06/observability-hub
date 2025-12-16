import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Docs from "./pages/Docs";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import AuthCallback from "./pages/AuthCallback";
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
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Index theme={theme} setTheme={setTheme} />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              
              {/* Protected Dashboard Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardLayout theme={theme} setTheme={setTheme} />
                  </ProtectedRoute>
                }
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
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
