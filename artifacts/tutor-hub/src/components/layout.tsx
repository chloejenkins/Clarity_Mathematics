import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  MessageSquare,
  CalendarDays,
  LogOut,
  GraduationCap,
  BookOpen,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@workspace/replit-auth-web";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const isTutor = user?.role === "tutor";

  const navigationItems = [
    { title: "Schedule", url: "/", icon: CalendarDays },
    { title: "Chat", url: "/chat", icon: MessageSquare },
    { title: "Assignments", url: "/assignments", icon: BookOpen },
  ];

  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    "User";

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <Sidebar className="border-r border-border/50 bg-card">
          <SidebarContent>
            <div className="p-6 flex items-center gap-3 border-b border-border/50">
              <div className="bg-primary/10 p-2 rounded-xl text-primary">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-bold text-lg leading-none">Tutoring for Understanding</h1>
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  {isTutor ? "Tutor Portal" : "Student Portal"}
                </span>
              </div>
            </div>

            <SidebarGroup className="mt-4">
              <SidebarGroupLabel className="px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent className="px-4 mt-2">
                <SidebarMenu className="gap-1">
                  {navigationItems.map((item) => {
                    const isActive = location === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link
                            href={item.url}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 ${
                              isActive
                                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                : "text-foreground hover:bg-secondary/50"
                            }`}
                          >
                            <item.icon
                              className={`h-5 w-5 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`}
                            />
                            <span className="font-medium">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-border/50 bg-card/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10 border border-border shadow-sm shrink-0">
                  <AvatarImage src={user?.profileImageUrl ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold leading-none truncate">{displayName}</span>
                  <span className="text-xs text-muted-foreground capitalize">{user?.role}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="text-muted-foreground hover:text-destructive shrink-0"
                title="Log out"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-14 flex items-center px-4 md:px-6 bg-background/80 backdrop-blur-md border-b border-border/50 sticky top-0 z-10 shrink-0">
            <SidebarTrigger className="text-muted-foreground hover-elevate" />
          </header>
          <main className="flex-1 overflow-auto bg-slate-50/50 dark:bg-transparent p-4 md:p-6">
            <div className="max-w-5xl mx-auto h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
