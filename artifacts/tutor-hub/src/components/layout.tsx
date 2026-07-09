import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  MessageSquare,
  CalendarDays,
  LogOut,
  BookOpen,
  CreditCard,
  ClipboardList,
  ChevronRight,
  Camera,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@workspace/replit-auth-web";
import { useClerk } from "@clerk/clerk-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { PaymentBanner } from "@/components/payment-banner";

interface LayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: LayoutProps) {
  const { user } = useAuth();
  const { signOut, openUserProfile } = useClerk();
  const [location] = useLocation();

  const isTutor = user?.role === "tutor";

  const isParent = user?.role === "parent";

  const tutorNav = [
    { title: "Schedule", url: "/", icon: CalendarDays },
    { title: "Chat", url: "/chat", icon: MessageSquare },
    { title: "Assignments", url: "/assignments", icon: BookOpen },
    { title: "Payments", url: "/payments", icon: CreditCard },
    { title: "Parent Reports", url: "/parent-reports", icon: ClipboardList },
  ];

  const parentNav = [
    { title: "Schedule", url: "/", icon: CalendarDays },
    { title: "Chat", url: "/chat", icon: MessageSquare },
    { title: "Assignments", url: "/assignments", icon: BookOpen },
    { title: "Payments", url: "/payments", icon: CreditCard },
    { title: "Feedback", url: "/parent-feedback", icon: ClipboardList },
  ];

  const studentNav = [
    { title: "Schedule", url: "/", icon: CalendarDays },
    { title: "Chat", url: "/chat", icon: MessageSquare },
    { title: "Assignments", url: "/assignments", icon: BookOpen },
  ];

  const navigationItems = isTutor ? tutorNav : isParent ? parentNav : studentNav;

  const currentPage =
    navigationItems.find((item) => item.url === location)?.title ?? "";

  const style = {
    "--sidebar-width": "17rem",
    "--sidebar-width-icon": "4rem",
  };

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    "User";

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <Sidebar className="border-r-0 bg-sidebar">
          <SidebarContent>
            {/* Logo */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-sidebar-border">
              <span className="font-display text-2xl font-bold tracking-tight text-[#c9a227] select-none">CM</span>
              <p className="text-[10px] text-sidebar-foreground/40 uppercase tracking-wider shrink-0">
                {isTutor ? "Tutor" : isParent ? "Parent" : "Student"}
              </p>
            </div>

            {/* Nav */}
            <SidebarGroup className="mt-3 px-3">
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {navigationItems.map((item) => {
                    const isActive = location === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link
                            href={item.url}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                              isActive
                                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                            }`}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
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

          <SidebarFooter className="p-4 border-t border-sidebar-border">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => openUserProfile()}
                title="Edit profile & photo"
                className="group flex items-center gap-2.5 min-w-0 -m-1 p-1 rounded-lg hover:bg-sidebar-accent transition-colors text-left"
              >
                <div className="relative shrink-0">
                  <Avatar className="h-8 w-8 ring-1 ring-white/10">
                    <AvatarImage src={user?.profileImageUrl ?? undefined} />
                    <AvatarFallback className="bg-[#c9a227]/20 text-[#e6c65c] text-xs font-bold">
                      {displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-sidebar ring-1 ring-sidebar-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-2.5 w-2.5 text-sidebar-foreground/80" />
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-sidebar-foreground leading-none truncate">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-sidebar-foreground/50 capitalize mt-0.5">
                    {user?.role} · <span className="group-hover:text-sidebar-foreground/80">Edit</span>
                  </p>
                </div>
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut({ redirectUrl: "/" })}
                className="h-8 w-8 text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-14 flex items-center gap-3 px-4 bg-background border-b border-border sticky top-0 z-10 shrink-0">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
            <nav className="flex items-center gap-2 min-w-0 text-sm" aria-label="Breadcrumb">
              <span className="font-display font-bold text-[#c9a227] shrink-0">CM</span>
              <span className="hidden sm:inline text-muted-foreground shrink-0">Clarity Mathematics</span>
              {currentPage && (
                <>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  <span className="font-semibold text-foreground truncate">{currentPage}</span>
                </>
              )}
            </nav>
            <div className="ml-auto flex items-center">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-background p-5 md:p-8">
            <div className="max-w-5xl mx-auto h-full">
              <PaymentBanner />
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
