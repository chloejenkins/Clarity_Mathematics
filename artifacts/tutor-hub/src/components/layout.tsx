import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  MessageSquare,
  CalendarDays,
  LogOut,
  BookOpen,
  CreditCard,
  ClipboardList,
  Camera,
  Menu,
  TrendingUp,
  Video,
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
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@workspace/replit-auth-web";
import { useClerk } from "@clerk/clerk-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { PaymentBanner } from "@/components/payment-banner";
import { SessionReminderBanner } from "@/components/session-reminder-banner";
import { ParentLinkRequestsBanner } from "@/components/parent-link-requests-banner";
import { PastSessionsBanner } from "@/components/past-sessions-check";

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
    { title: "Video Library", url: "/videos", icon: Video },
    { title: "Payments", url: "/payments", icon: CreditCard },
    { title: "Parent Reports", url: "/parent-reports", icon: ClipboardList },
  ];

  const parentNav = [
    { title: "Schedule", url: "/", icon: CalendarDays },
    { title: "Chat", url: "/chat", icon: MessageSquare },
    { title: "Assignments", url: "/assignments", icon: BookOpen },
    { title: "Video Library", url: "/videos", icon: Video },
    { title: "Progress", url: "/progress", icon: TrendingUp },
    { title: "Payments", url: "/payments", icon: CreditCard },
    { title: "Feedback", url: "/parent-feedback", icon: ClipboardList },
  ];

  const studentNav = [
    { title: "Schedule", url: "/", icon: CalendarDays },
    { title: "Chat", url: "/chat", icon: MessageSquare },
    { title: "Assignments", url: "/assignments", icon: BookOpen },
    { title: "Video Library", url: "/videos", icon: Video },
    { title: "Progress", url: "/progress", icon: TrendingUp },
    { title: "Payments", url: "/payments", icon: CreditCard },
  ];

  const navigationItems = isTutor ? tutorNav : isParent ? parentNav : studentNav;

  const style = {
    "--sidebar-width": "16.5rem",
    "--sidebar-width-icon": "4rem",
  };

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    "User";

  const roleLabel = isTutor ? "Tutor" : isParent ? "Parent" : "Student";

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <CloseSidebarOnNavigate location={location} />
      <div className="flex h-dvh w-full bg-background overflow-hidden">
        <Sidebar className="border-r-0 bg-sidebar">
          <SidebarContent>
            {/* The one place the wordmark appears inside the app (HIG Branding:
                don't repeat the logo; let it defer to content). */}
            <div className="px-4 pt-5 pb-2 flex items-center justify-between gap-2">
              <Logo className="text-sidebar-foreground" style={{ fontSize: "0.9375rem" }} />
              <span className="text-xs text-muted-foreground shrink-0">
                {roleLabel}
              </span>
            </div>

            <SidebarGroup className="mt-1 px-2.5">
              <SidebarGroupContent>
                <nav aria-label="Main">
                  <SidebarMenu className="gap-1">
                    {navigationItems.map((item) => {
                      const isActive = location === item.url;
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild isActive={isActive} className="h-9 pointer-coarse:h-11 px-3 gap-3 rounded-[10px] text-[15px] data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-semibold hover:bg-sidebar-accent data-[active=true]:hover:bg-sidebar-primary data-[active=true]:hover:text-sidebar-primary-foreground">
                            <Link
                              href={item.url}
                              aria-current={isActive ? "page" : undefined}
                              className={cn(
                                "flex items-center transition-colors",
                                !isActive && "text-sidebar-foreground",
                              )}
                            >
                              <item.icon
                                className={cn(
                                  "h-[18px] w-[18px] shrink-0",
                                  isActive ? "text-sidebar-primary-foreground" : "text-brand",
                                )}
                                aria-hidden
                              />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </nav>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-2.5 border-t border-sidebar-border pb-[max(0.625rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => openUserProfile()}
                aria-label={`${displayName}, edit profile and photo`}
                className="group flex flex-1 items-center gap-3 min-w-0 p-2 rounded-[10px] hover:bg-sidebar-accent transition-colors text-left"
              >
                <div className="relative shrink-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.profileImageUrl ?? undefined} alt="" />
                    <AvatarFallback className="bg-gradient-to-b from-[#a1a1a6] to-[#8e8e93] text-white text-sm font-semibold">
                      {displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-sidebar ring-1 ring-sidebar-border flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                    <Camera className="h-2.5 w-2.5 text-sidebar-foreground/80" aria-hidden />
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-sidebar-foreground leading-tight truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Edit profile
                  </p>
                </div>
              </button>
              <div className="md:hidden [&_button]:text-brand">
                <ThemeToggle />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut({ redirectUrl: "/" })}
                className="text-brand hover:bg-sidebar-accent shrink-0"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 min-w-0">
          {/* Desktop toolbar: sidebar toggle and appearance. The page's own
              title sits in the content, so it isn't repeated here. On phones
              the tab bar replaces this bar entirely. */}
          <header className="hidden md:flex h-12 items-center gap-2 px-4 shrink-0">
            <SidebarTrigger
              className="h-9 w-9 text-brand hover:bg-accent"
              aria-label="Show or hide sidebar"
            />
            <div className="ml-auto flex items-center">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-background px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 md:px-8 md:pt-2 md:pb-10 lg:px-10">
            <div className="max-w-5xl mx-auto h-full">
              <ParentLinkRequestsBanner />
              <SessionReminderBanner />
              <PastSessionsBanner />
              <PaymentBanner />
              {children}
            </div>
          </main>
        </div>

        <MobileTabBar items={navigationItems} location={location} />
      </div>
    </SidebarProvider>
  );
}

type NavItem = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

/** Close the phone navigation sheet after a link is followed. */
function CloseSidebarOnNavigate({ location }: { location: string }) {
  const { setOpenMobile } = useSidebar();
  useEffect(() => {
    setOpenMobile(false);
  }, [location, setOpenMobile]);
  return null;
}

/**
 * Phone navigation: a bottom tab bar with the four most-used sections
 * and a More tab that opens the full sidebar (HIG Tab bars: top-level
 * navigation stays visible and in reach on compact widths; tabs
 * navigate, never act). Hidden from md up, where the sidebar shows.
 */
function MobileTabBar({ items, location }: { items: NavItem[]; location: string }) {
  const { setOpenMobile, openMobile } = useSidebar();
  const primary = items.slice(0, 3).concat(items.filter((i) => i.url === "/payments"));
  const inPrimary = primary.some((i) => i.url === location);

  return (
    <nav
      aria-label="Sections"
      className="md:hidden fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/85 backdrop-blur-xl backdrop-saturate-150 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {primary.map((item) => {
          const active = item.url === location;
          return (
            <li key={item.url}>
              <Link
                href={item.url}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[52px] flex-col items-center justify-center gap-1 text-[11px] font-medium leading-none",
                  active ? "text-brand" : "text-muted-foreground",
                )}
              >
                <item.icon className="h-6 w-6" aria-hidden />
                <span className="max-w-full truncate px-0.5">{tabLabel(item.title)}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => setOpenMobile(true)}
            aria-expanded={openMobile}
            className={cn(
              "flex h-[52px] w-full flex-col items-center justify-center gap-1 text-[11px] font-medium leading-none",
              !inPrimary ? "text-brand" : "text-muted-foreground",
            )}
          >
            <Menu className="h-6 w-6" aria-hidden />
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

/** Single-word tab labels where the sidebar uses two. */
function tabLabel(title: string): string {
  return title === "Video Library" ? "Videos" : title;
}
