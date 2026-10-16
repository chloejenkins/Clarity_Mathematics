import { useMemo, useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useListVideos,
  useCreateVideo,
  useUpdateVideo,
  useDeleteVideo,
  getListVideosQueryKey,
  type Video as VideoItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Video, Plus, Trash2, PlayCircle, Pencil, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Suggested topics for the library, in the order they're shown. Tutors can
// type any other topic too; videos with no topic go under "Other topics".
const BASIC_TOPICS = [
  "Number & place value",
  "Addition & subtraction",
  "Multiplication & division",
  "Fractions & decimals",
  "Percentages",
  "Ratio & proportion",
  "Algebra",
  "Equations",
  "Geometry",
  "Measurement",
  "Statistics",
  "Probability",
];
const OTHER_TOPIC = "Other topics";

// Extracts the 11-character YouTube video id for the embed and thumbnail.
function getYouTubeId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

const videoSchema = z.object({
  title: z.string().trim().min(1, "Title required"),
  url: z.string().trim().refine((u) => getYouTubeId(u) !== null, "Must be a YouTube video link"),
  description: z.string().optional(),
  subject: z.string().optional(),
});
type VideoForm = z.infer<typeof videoSchema>;

const topicOf = (v: VideoItem) => v.subject?.trim() || OTHER_TOPIC;

function topicOrder(a: string, b: string) {
  const rank = (t: string) => {
    if (t === OTHER_TOPIC) return Number.MAX_SAFE_INTEGER;
    const i = BASIC_TOPICS.findIndex((x) => x.toLowerCase() === t.toLowerCase());
    return i === -1 ? BASIC_TOPICS.length : i;
  };
  return rank(a) - rank(b) || a.localeCompare(b);
}

export default function VideosPage() {
  const { user } = useAuth();
  const isTutor = user?.role === "tutor";

  const { data: videos, isLoading } = useListVideos();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useCreateVideo();
  const updateMutation = useUpdateVideo();
  const deleteMutation = useDeleteVideo();

  // null = closed, "new" = adding, otherwise the video being edited.
  const [editing, setEditing] = useState<VideoItem | "new" | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState<string | null>(null);

  const form = useForm<VideoForm>({
    resolver: zodResolver(videoSchema),
    defaultValues: { title: "", url: "", description: "", subject: "" },
  });

  // Tutors manage the videos they added, plus older ones with no recorded uploader.
  const canManage = (v: VideoItem) => isTutor && (!v.tutorId || v.tutorId === user?.id);

  const openAdd = () => {
    form.reset({ title: "", url: "", description: "", subject: "" });
    setEditing("new");
  };
  const openEdit = (v: VideoItem) => {
    form.reset({ title: v.title, url: v.url, description: v.description ?? "", subject: v.subject ?? "" });
    setEditing(v);
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListVideosQueryKey() });

  const onSubmit = (values: VideoForm) => {
    const onError = () => toast({ title: "Couldn't save the video", variant: "destructive" });
    if (editing && editing !== "new") {
      updateMutation.mutate(
        {
          id: editing.id,
          data: {
            title: values.title,
            url: values.url,
            description: values.description?.trim() || null,
            subject: values.subject?.trim() || null,
          },
        },
        {
          onSuccess: () => { refresh(); setEditing(null); toast({ title: "Video updated" }); },
          onError,
        },
      );
    } else {
      createMutation.mutate(
        { data: values },
        {
          onSuccess: () => { refresh(); setEditing(null); toast({ title: "Video added to the library" }); },
          onError,
        },
      );
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Remove this video from the library?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => { refresh(); toast({ title: "Video removed" }); },
      onError: () => toast({ title: "Couldn't remove the video", variant: "destructive" }),
    });
  };

  const topics = useMemo(
    () => Array.from(new Set((videos ?? []).map(topicOf))).sort(topicOrder),
    [videos],
  );

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (videos ?? []).filter((v) =>
      (!topic || topicOf(v) === topic) &&
      (!q || [v.title, v.description, v.subject].some((f) => f?.toLowerCase().includes(q))),
    );
    const byTopic = new Map<string, VideoItem[]>();
    for (const v of matches) byTopic.set(topicOf(v), [...(byTopic.get(topicOf(v)) ?? []), v]);
    return Array.from(byTopic.entries()).sort(([a], [b]) => topicOrder(a, b));
  }, [videos, search, topic]);

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const hasVideos = (videos?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 text-white p-8 rounded-3xl shadow-xl bg-[url('https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1200&q=80')] bg-cover bg-center relative overflow-hidden">
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"></div>
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-display font-bold flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-xl text-primary-foreground"><Video className="h-8 w-8" /></div> Video Library
          </h1>
          <p className="text-slate-300 mt-2 max-w-lg">
            {isTutor
              ? "Short lessons on the basics. Every student can watch the videos you add here."
              : "Short lessons on the basics. Watch any time to refresh a topic."}
          </p>
        </div>

        {isTutor && (
          <Button size="lg" onClick={openAdd} className="rounded-xl shadow-lg relative z-10 bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 h-5 w-5" /> Add Video
          </Button>
        )}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing && editing !== "new" ? "Edit video" : "Add a YouTube video"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input placeholder="e.g. Adding fractions with different denominators" className="rounded-xl" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="url" render={({ field }) => (
                <FormItem>
                  <FormLabel>YouTube link</FormLabel>
                  <FormControl><Input placeholder="https://youtube.com/watch?v=..." className="rounded-xl" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="subject" render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic</FormLabel>
                  <FormControl>
                    <Input list="video-topics" placeholder="Pick or type a topic" className="rounded-xl" autoComplete="off" {...field} />
                  </FormControl>
                  <datalist id="video-topics">
                    {Array.from(new Set([...BASIC_TOPICS, ...topics.filter((t) => t !== OTHER_TOPIC)])).map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                  <FormDescription>Videos are grouped by topic in the library.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="What does it cover?" className="rounded-xl min-h-[80px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full rounded-xl mt-4" disabled={isSaving}>
                {isSaving ? "Saving..." : editing && editing !== "new" ? "Save changes" : "Add Video"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {hasVideos && (
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search videos"
              aria-label="Search videos"
              className="pl-9 rounded-xl"
            />
          </div>
          {topics.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by topic">
              <Button size="sm" variant={topic === null ? "default" : "outline"} className="rounded-full" onClick={() => setTopic(null)}>
                All topics
              </Button>
              {topics.map((t) => (
                <Button key={t} size="sm" variant={topic === t ? "default" : "outline"} className="rounded-full" onClick={() => setTopic(topic === t ? null : t)}>
                  {t}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-8">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : !hasVideos ? (
        <EmptyState
          icon={Video}
          title="No videos in the library yet."
          description={isTutor ? "Add a YouTube video and every student will be able to watch it here." : undefined}
        />
      ) : sections.length === 0 ? (
        <EmptyState icon={Search} title="No videos match your search." />
      ) : (
        <div className="space-y-10">
          {sections.map(([sectionTopic, items]) => (
            <section key={sectionTopic} aria-label={sectionTopic}>
              <h2 className="text-xl font-display font-bold mb-4">
                {sectionTopic} <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {items.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    isPlaying={playingId === video.id}
                    onPlay={() => setPlayingId(video.id)}
                    onEdit={canManage(video) ? () => openEdit(video) : undefined}
                    onDelete={canManage(video) ? () => handleDelete(video.id) : undefined}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function VideoCard({ video, isPlaying, onPlay, onEdit, onDelete }: {
  video: VideoItem;
  isPlaying: boolean;
  onPlay: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const ytId = getYouTubeId(video.url);

  return (
    <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden flex flex-col group bg-card">
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
            {ytId && (
              <img
                src={`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`}
                alt={video.title}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                onError={(e) => { e.currentTarget.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`; }}
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
              {ytId ? (
                <button
                  onClick={onPlay}
                  aria-label={`Play ${video.title}`}
                  className="h-16 w-16 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all drop-shadow-xl"
                >
                  <PlayCircle className="w-full h-full" />
                </button>
              ) : (
                <a href={video.url} target="_blank" rel="noreferrer" className="text-white underline text-sm">Open video</a>
              )}
            </div>
            {(onEdit || onDelete) && (
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                {onEdit && (
                  <Button variant="secondary" size="icon" className="shadow-md h-8 w-8" aria-label={`Edit ${video.title}`} onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button variant="destructive" size="icon" className="shadow-md h-8 w-8" aria-label={`Remove ${video.title}`} onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <CardContent className="p-5 flex-1 flex flex-col">
        <h3 className="font-bold text-lg leading-tight mb-2 text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {video.title}
        </h3>
        {video.description && (
          <p className="text-sm text-muted-foreground line-clamp-3 mt-auto">{video.description}</p>
        )}
      </CardContent>
    </Card>
  );
}
