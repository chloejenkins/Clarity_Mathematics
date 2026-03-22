import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { useListSessions, useListUsers, useListAssignments } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CalendarDays, BookOpen, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default function TutorDashboard() {
  const { user } = useAuth();
  
  const { data: sessions, isLoading: loadingSessions } = useListSessions();
  const { data: students, isLoading: loadingStudents } = useListUsers();
  const { data: assignments, isLoading: loadingAssignments } = useListAssignments();

  const pendingSessions = sessions?.filter(s => s.status === 'pending') || [];
  const upcomingSessions = sessions?.filter(s => s.status === 'approved' && new Date(s.scheduledAt) > new Date()) || [];
  
  const StatCard = ({ title, value, icon: Icon, colorClass }: any) => (
    <Card className="hover:shadow-md transition-shadow duration-300 border-none shadow-sm">
      <CardContent className="p-6 flex items-center gap-4">
        <div className={`p-4 rounded-2xl ${colorClass}`}>
          <Icon className="h-8 w-8" />
        </div>
        <div>
          <p className="text-sm font-semibold text-muted-foreground mb-1">{title}</p>
          <h3 className="text-3xl font-display font-bold">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Welcome back, {user?.firstName}! 👋</h1>
        <p className="text-muted-foreground mt-2 text-lg">Here's what's happening with your students today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Total Students" 
          value={loadingStudents ? "-" : students?.filter(u => u.role === 'student').length} 
          icon={Users} 
          colorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" 
        />
        <StatCard 
          title="Pending Requests" 
          value={loadingSessions ? "-" : pendingSessions.length} 
          icon={CalendarDays} 
          colorClass="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" 
        />
        <StatCard 
          title="Active Assignments" 
          value={loadingAssignments ? "-" : assignments?.length} 
          icon={BookOpen} 
          colorClass="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xl font-display font-bold">Upcoming Sessions</CardTitle>
            <Button variant="ghost" size="sm" asChild className="hover-elevate">
              <Link href="/sessions">View All <ArrowRight className="ml-2 h-4 w-4"/></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingSessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No upcoming sessions.</p>
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                {upcomingSessions.slice(0, 4).map(session => (
                  <div key={session.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border/50">
                    <div>
                      <p className="font-bold text-foreground">{session.studentName || "Student"}</p>
                      <p className="text-sm text-muted-foreground">{session.topic || "General Math"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary">{format(new Date(session.scheduledAt), "MMM d, h:mm a")}</p>
                      <p className="text-xs text-muted-foreground">{session.durationMinutes} mins</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xl font-display font-bold">Action Needed</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingSessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🎉</span>
                </div>
                <p>You're all caught up!</p>
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                {pendingSessions.slice(0, 4).map(session => (
                  <div key={session.id} className="flex items-center justify-between p-4 rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900/50">
                    <div>
                      <p className="font-bold">{session.studentName || "Student"}</p>
                      <p className="text-sm text-muted-foreground">Requests {format(new Date(session.scheduledAt), "MMM d, h:mm a")}</p>
                    </div>
                    <Button size="sm" asChild>
                      <Link href="/sessions">Review</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
