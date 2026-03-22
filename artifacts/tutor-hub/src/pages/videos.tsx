import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useListVideos, useCreateVideo, useDeleteVideo } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Video, Plus, Trash2, PlayCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const createSchema = z.object({
  title: z.string().min(1, "Title required"),
  url: z.string().url("Must be a valid URL").includes("youtube.com", { message: "Must be a YouTube link" }).or(z.string().includes("youtu.be")),
  description: z.string().optional(),
  subject: z.string().optional(),
});

// Helper to extract youtube video ID for iframe and thumbnail
function getYouTubeId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default function VideosPage() {
  const { user } = useAuth();
  const isTutor = user?.role === "tutor";
  
  const { data: videos, isLoading } = useListVideos();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createMutation = useCreateVideo();
  const deleteMutation = useDeleteVideo();

  const [isOpen, setIsOpen] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { title: "", url: "", description: "", subject: "" }
  });

  const onSubmit = (values: z.infer<typeof createSchema>) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/videos'] });
        setIsOpen(false);
        form.reset();
        toast({ title: "Video shared successfully!" });
      }
    });
  };

  const handleDelete = (id: number) => {
    if(confirm("Remove this video?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/videos'] });
          toast({ title: "Video removed" });
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 text-white p-8 rounded-3xl shadow-xl bg-[url('https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1200&q=80')] bg-cover bg-center relative overflow-hidden">
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"></div>
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-display font-bold flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-xl text-primary-foreground"><Video className="h-8 w-8" /></div> Video Tutorials
          </h1>
          <p className="text-slate-300 mt-2 max-w-lg">Watch curated math lessons to reinforce what we covered in our sessions.</p>
        </div>
        
        {isTutor && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="rounded-xl shadow-lg relative z-10 bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="mr-2 h-5 w-5"/> Add Video
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl">
              <DialogHeader>
                <DialogTitle>Share a YouTube Video</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl><Input placeholder="Video title..." className="rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="url" render={({ field }) => (
                    <FormItem>
                      <FormLabel>YouTube URL</FormLabel>
                      <FormControl><Input placeholder="https://youtube.com/watch?v=..." className="rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="subject" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl><Input placeholder="e.g. Geometry" className="rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Why watch this?" className="rounded-xl min-h-[80px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full rounded-xl mt-4" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Adding..." : "Add Video"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-pulse mt-8">
           {[1,2,3].map(i => <div key={i} className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-8">
          {videos?.map((video) => {
            const ytId = getYouTubeId(video.url);
            const isPlaying = playingId === video.id;

            return (
              <Card key={video.id} className="border-none shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden flex flex-col group bg-card">
                <div className="relative aspect-video bg-black flex-shrink-0">
                  {isPlaying && ytId ? (
                    <iframe 
                      width="100%" 
                      height="100%" 
                      src={`https://www.youtube.com/embed/${ytId}?autoplay=1`} 
                      title={video.title} 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen
                      className="absolute inset-0"
                    ></iframe>
                  ) : (
                    <>
                      <img 
                        src={`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`} 
                        alt={video.title}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        onError={(e) => { e.currentTarget.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                        <button 
                          onClick={() => setPlayingId(video.id)}
                          className="h-16 w-16 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all drop-shadow-xl"
                        >
                          <PlayCircle className="w-full h-full" />
                        </button>
                      </div>
                      {isTutor && (
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-md h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); handleDelete(video.id); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
                <CardContent className="p-5 flex-1 flex flex-col">
                  <div className="mb-2">
                     <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded">
                       {video.subject || "Math"}
                     </span>
                  </div>
                  <h3 className="font-bold text-lg leading-tight mb-2 text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {video.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-3 mt-auto">
                    {video.description || "No description provided."}
                  </p>
                </CardContent>
              </Card>
            );
          })}
          {videos?.length === 0 && (
             <div className="col-span-full text-center py-20 border-2 border-dashed rounded-3xl text-muted-foreground">
               <Video className="h-16 w-16 mx-auto mb-4 opacity-20" />
               <p className="text-lg">No videos added yet.</p>
             </div>
          )}
        </div>
      )}
    </div>
  );
}
