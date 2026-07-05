import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth as useClerkAuth, useSession } from "@clerk/clerk-react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout";
import LandingPage from "@/pages/landing";
import SchedulePage from "@/pages/sessions";
import ChatPage from "@/pages/chat";
import AssignmentsPage from "@/pages/assignments";
import PaymentsPage from "@/pages/payments";
import ParentReportsPage from "@/pages/parent-reports";
import ParentFeedbackViewPage from "@/pages/parent-feedback-view";
import OnboardingPage from "@/pages/onboarding";

const queryClient = new QueryClient();

function ClerkTokenProvider() {
  const { session } = useSession();

  useEffect(() => {
    if (session) {
      setAuthTokenGetter(() => session.getToken());
    } else {
      setAuthTokenGetter(null);
    }
  }, [session]);

  return null;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLoaded, isSignedIn } = useClerkAuth();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoaded && isSignedIn && user?.role === "pending") {
      navigate("/onboarding");
    }
  }, [isLoaded, isSignedIn, user?.role, navigate]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <LandingPage />;
  }

  if (user?.role === "pending") {
    return null;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/"><ProtectedRoute component={SchedulePage} /></Route>
      <Route path="/chat"><ProtectedRoute component={ChatPage} /></Route>
      <Route path="/assignments"><ProtectedRoute component={AssignmentsPage} /></Route>
      <Route path="/payments"><ProtectedRoute component={PaymentsPage} /></Route>
      <Route path="/parent-reports"><ProtectedRoute component={ParentReportsPage} /></Route>
      <Route path="/parent-feedback"><ProtectedRoute component={ParentFeedbackViewPage} /></Route>
      <Route path="/onboarding"><OnboardingPage /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ClerkTokenProvider />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
