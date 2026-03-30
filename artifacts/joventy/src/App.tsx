import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider, useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// Pages
import Landing from "@/pages/Landing";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import NotFound from "@/pages/not-found";

import ClientDashboard from "@/pages/client/Dashboard";
import ClientApplications from "@/pages/client/Applications";
import NewApplication from "@/pages/client/NewApplication";
import ClientApplicationDetail from "@/pages/client/ApplicationDetail";

import AdminDashboard from "@/pages/admin/Dashboard";
import AdminApplications from "@/pages/admin/Applications";
import AdminApplicationDetail from "@/pages/admin/ApplicationDetail";
import AdminClients from "@/pages/admin/Clients";

const queryClient = new QueryClient();

// Custom Redirect Component for Wouter
const Redirect = ({ to }: { to: string }) => {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(to); }, [to, setLocation]);
  return null;
};

// Protected Route Wrapper
const ProtectedRoute = ({ component: Component, adminOnly = false, layoutProps = {}, ...rest }: any) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-muted-foreground">Chargement...</div>;
  }
  
  if (!user) {
    return <Redirect to="/login" />;
  }
  
  if (adminOnly && user.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

  return (
    <DashboardLayout isAdmin={adminOnly} {...layoutProps}>
      <Component {...rest} />
    </DashboardLayout>
  );
};

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />

      {/* Client Protected Routes */}
      <Route path="/dashboard">
        {() => <ProtectedRoute component={ClientDashboard} />}
      </Route>
      <Route path="/dashboard/applications">
        {() => <ProtectedRoute component={ClientApplications} />}
      </Route>
      <Route path="/dashboard/applications/new">
        {() => <ProtectedRoute component={NewApplication} />}
      </Route>
      <Route path="/dashboard/applications/:id">
        {() => <ProtectedRoute component={ClientApplicationDetail} />}
      </Route>

      {/* Admin Protected Routes */}
      <Route path="/admin">
        {() => <ProtectedRoute adminOnly component={AdminDashboard} />}
      </Route>
      <Route path="/admin/applications">
        {() => <ProtectedRoute adminOnly component={AdminApplications} />}
      </Route>
      <Route path="/admin/applications/:id">
        {() => <ProtectedRoute adminOnly component={AdminApplicationDetail} />}
      </Route>
      <Route path="/admin/clients">
        {() => <ProtectedRoute adminOnly component={AdminClients} />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
