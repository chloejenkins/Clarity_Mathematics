import { useAuth } from "@workspace/replit-auth-web";
import { useListSessions, useListAssignments, useListVideos } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, BookOpen, Video, Plus, PlayCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default function StudentDashboard() {
  const { user } = useAuth();
  
  const { data: sessions } = useListSessions({ studentId: user?.id });
  const { data: assignments } = useListAssignments();
  const { data: videos } = useListVideos();

  const upcomingSessions = sessions?.filter(s => s.status === 'approved' && new Date(s.scheduledAt) > new Date()) || [];
  const nextSession = upcomingSessions.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-primary to-primary/80 p-8 rounded-3xl text-primary-foreground shadow-xl shadow-primary/20">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">Ready to learn, {user?.firstName}? 🚀</h1>
          <p className="text-primary-foreground/80 text-lg">Your math journey continues here.</p>
        </div>
        <Button size="lg" variant="secondary" asChild className="shrink-0 rounded-xl hover-elevate">
          <Link href="/sessions"><Plus className="mr-2 h-5 w-5" /> Request Session</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-5 space-y-8">
          <Card className="border-none shadow-md overflow-hidden bg-gradient-to-br from-secondary/40 to-background border border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                <CalendarDays className="h-5 w-5 text-secondary-foreground" /> Next Session
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nextSession ? (
                <div className="py-4">
                  <h3 className="text-3xl font-display font-bold text-foreground mb-1">
                    {format(new Date(nextSession.scheduledAt), "EEEE")}
                  </h3>
                  <p className="text-xl text-muted-foreground mb-6">
                    {format(new Date(nextSession.scheduledAt), "h:mm a")}
                  </p>
                  <div className="inline-block px-4 py-2 bg-background rounded-lg text-sm font-semibold border shadow-sm">
                    Topic: {nextSession.topic || "General Review"}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <p className="mb-4">No sessions scheduled.</p>
                  <Button variant="outline" asChild>
                    <Link href="/sessions">Schedule Now</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" /> Assignments
              </CardTitle>
              <Link href="/assignments" className="text-sm font-semibold text-primary hover:underline">View All</Link>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {assignments?.slice(0, 3).map(a => (
                  <div key={a.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border hover-elevate cursor-pointer">
                    <h4 className="font-bold text-sm line-clamp-1">{a.title}</h4>
                    {a.dueDate && (
                      <p className="text-xs text-muted-foreground mt-1">Due: {format(new Date(a.dueDate), "MMM d")}</p>
                    )}
                  </div>
                ))}
                {(!assignments || assignments.length === 0) && (
                   <p className="text-sm text-muted-foreground text-center py-4">No assignments right now.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-7">
          <Card className="border-none shadow-md h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-display font-bold flex items-center gap-2">
                <Video className="h-6 w-6 text-accent" /> Recommended Videos
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                 <Link href="/videos">Browse Library</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                {videos?.slice(0, 4).map(v => (
                  <Link href={`/videos`} key={v.id}>
                    <div className="group rounded-2xl overflow-hidden border border-border bg-card shadow-sm hover-elevate cursor-pointer flex flex-col h-full">
                      <div className="aspect-video bg-muted relative flex items-center justify-center">
                        <img 
                          src={`https://img.youtube.com/vi/${v.url.split('v=')[1]?.split('&')[0]}/hqdefault.jpg`} 
                          alt="thumbnail"
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                          onError={(e) => {
                             // fallback if not a standard youtube url
                             e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <PlayCircle className="h-12 w-12 text-white opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all drop-shadow-md" />
                        </div>
                      </div>
                      <div className="p-4 flex-1">
                        <h4 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2">{v.title}</h4>
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-1">{v.subject}</p>
                      </div>
                    </div>
                  </Link>
                ))}
                {(!videos || videos.length === 0) && (
                   <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-2xl">
                     <Video className="h-12 w-12 mx-auto mb-3 opacity-20" />
                     <p>No videos available.</p>
                   </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
