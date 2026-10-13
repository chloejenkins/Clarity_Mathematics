import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth as useClerkAuth, useSession, useUser } from "@clerk/clerk-react";
import { setAuthTokenGetter, customFetch } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout";
import LandingPage from "@/pages/landing";
import SchedulePage from "@/pages/sessions";
import ChatPage from "@/pages/chat";
import AssignmentsPage from "@/pages/assignments";
import ProgressPage from "@/pages/progress";
import PaymentsPage from "@/pages/payments";
import ParentReportsPage from "@/pages/parent-reports";
import ParentFeedbackViewPage from "@/pages/parent-feedback-view";
import OnboardingPage from "@/pages/onboarding";
import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";

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

// Keeps our DB copy of the user's name/avatar in sync with Clerk, so profile
// picture changes propagate to other users (chat, lists, etc.).
function ProfileSync() {
  const { isSignedIn, user } = useUser();
  const imageUrl = user?.imageUrl;
  const firstName = user?.firstName;
  const lastName = user?.lastName;
  const username = user?.username;

  useEffect(() => {
    if (!isSignedIn) return;
    customFetch("/api/auth/sync-profile", { method: "POST" }).catch(() => {
      /* not fatal, will retry on next profile change */
    });
  }, [isSignedIn, imageUrl, firstName, lastName, username]);

  return null;
}

function ProtectedRoute({ component: Component, roles }: {
  component: React.ComponentType;
  /** Roles allowed on this page; anyone else is sent to the home page. */
  roles?: string[];
}) {
  const { isLoaded, isSignedIn } = useClerkAuth();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const wrongRole = Boolean(roles && user && user.role !== "pending" && !roles.includes(user.role));

  useEffect(() => {
    if (isLoaded && isSignedIn && user?.role === "pending") {
      navigate("/onboarding");
    } else if (isLoaded && isSignedIn && wrongRole) {
      navigate("/");
    }
  }, [isLoaded, isSignedIn, user?.role, wrongRole, navigate]);

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

  if (user?.role === "pending" || wrongRole) {
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
      <Route path="/progress"><ProtectedRoute component={ProgressPage} /></Route>
      <Route path="/payments"><ProtectedRoute component={PaymentsPage} /></Route>
      <Route path="/parent-reports"><ProtectedRoute component={ParentReportsPage} /></Route>
      <Route path="/parent-feedback"><ProtectedRoute component={ParentFeedbackViewPage} roles={["parent"]} /></Route>
      <Route path="/onboarding"><OnboardingPage /></Route>
      <Route path="/privacy"><PrivacyPage /></Route>
      <Route path="/terms"><TermsPage /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ClerkTokenProvider />
        <ProfileSync />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
