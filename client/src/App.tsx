import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthHandler } from "@/components/AuthHandler";
import Home from "@/pages/Home";


import Landing from "@/pages/Landing";
import WelcomeClean from "@/pages/WelcomeClean";
import DashboardClean from "@/pages/DashboardClean";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import AuthRedirect from "@/pages/AuthRedirect";
import Dashboard from "@/pages/Dashboard";
import Voting from "@/pages/Voting";
import Results from "@/pages/Results";
import Events from "@/pages/Events";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/auth/redirect" component={AuthRedirect} />

      <Route path="/welcome-clean" component={WelcomeClean} />
      <Route path="/dashboard-clean" component={DashboardClean} />

      <Route path="/" component={Landing} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/voting">
        <ProtectedRoute>
          <Voting />
        </ProtectedRoute>
      </Route>
      <Route path="/results">
        <ProtectedRoute>
          <Results />
        </ProtectedRoute>
      </Route>
      <Route path="/events">
        <ProtectedRoute>
          <Events />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <AuthHandler />
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
