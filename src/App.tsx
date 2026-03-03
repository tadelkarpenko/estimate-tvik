import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewEstimate from "./pages/NewEstimate";
import EstimatesList from "./pages/EstimatesList";
import CostLibraryPage from "./pages/CostLibraryPage";
import RiskLibraryPage from "./pages/RiskLibraryPage";
import CostAuditPage from "./pages/CostAuditPage";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/admin-dashboard" replace />} />
            <Route element={<AuthGate><AppLayout /></AuthGate>}>
              <Route path="/admin-dashboard" element={<Dashboard />} />
              <Route path="/estimates/new" element={<NewEstimate />} />
              <Route path="/estimates/:id" element={<NewEstimate />} />
              <Route path="/estimates" element={<EstimatesList />} />
              <Route path="/cost-library" element={<CostLibraryPage />} />
              <Route path="/risk-library" element={<RiskLibraryPage />} />
              <Route path="/cost-audit" element={<CostAuditPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
