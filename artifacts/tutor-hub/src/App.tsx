import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@workspace/replit-auth-web";
import NotFound from "@/pages/not-found";

// Components & Pages
import { AppLayout } from "@/components/layout";
import LandingPage from "@/pages/landing";
import TutorDashboard from "@/pages/dashboard-tutor";
import StudentDashboard from "@/pages/dashboard-student";
import SessionsPage from "@/pages/sessions";
import ChatPage from "@/pages/chat";
import AssignmentsPage from "@/pages/assignments";
import VideosPage from "@/pages/videos";

const queryClient = new QueryClient();

// Route Guard Component
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          <p className="text-muted-foreground font-medium">Loading portal...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

// Home Route Router (decides which dashboard to show based on role)
function HomeRoute() {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return null; // handled by parent or just empty until ready
  
  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <AppLayout>
      {user?.role === "tutor" ? <TutorDashboard /> : <StudentDashboard />}
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRoute} />
      <Route path="/sessions"><ProtectedRoute component={SessionsPage} /></Route>
      <Route path="/chat"><ProtectedRoute component={ChatPage} /></Route>
      <Route path="/assignments"><ProtectedRoute component={AssignmentsPage} /></Route>
      <Route path="/videos"><ProtectedRoute component={VideosPage} /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
