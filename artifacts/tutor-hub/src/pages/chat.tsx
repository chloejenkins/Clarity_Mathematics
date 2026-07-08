import { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useListUsers, customFetch } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Send, MessageSquare, Plus, Users, Check } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";

interface Participant {
  id: string;
  name: string;
  role: string | null;
  imageUrl: string | null;
}
interface Conversation {
  id: number;
  type: string;
  title: string | null;
  participants: Participant[];
  lastMessage: string | null;
  lastMessageAt: string;
}
interface ChatMessage {
  id: number;
  conversationId: number | null;
  senderId: string;
  content: string;
  createdAt: string;
  senderName: string;
  senderImageUrl: string | null;
}

function formatMsgTime(dateStr: string | Date) {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`;
  return format(date, "MMM d, h:mm a");
}

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function userLabel(u: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}) {
  return (
    [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "User"
  );
}

export default function ChatPage() {
  const { user } = useAuth();
  const myId = user?.id;
  const queryClient = useQueryClient();

  const { data: users } = useListUsers();

  const { data: conversations } = useQuery({
    queryKey: ["/api/conversations"],
    queryFn: () => customFetch<Conversation[]>("/api/conversations"),
    refetchInterval: 5000,
  });

  const [selectedId, setSelectedId] = useState<number | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Auto-select the first conversation once loaded.
  useEffect(() => {
    if (selectedId === undefined && conversations && conversations.length > 0) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["/api/conversations", selectedId, "messages"],
    queryFn: () =>
      customFetch<ChatMessage[]>(`/api/conversations/${selectedId}/messages`),
    enabled: selectedId !== undefined,
    refetchInterval: 4000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      customFetch<ChatMessage>(`/api/conversations/${selectedId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedId, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || selectedId === undefined || sendMutation.isPending) return;
    sendMutation.mutate(draft.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  };

  const activeConv = conversations?.find((c) => c.id === selectedId);

  const convTitle = (c: Conversation) => {
    const others = c.participants.filter((p) => p.id !== myId);
    if (c.type === "group") {
      return c.title || others.map((p) => p.name).join(", ") || "Group";
    }
    return others[0]?.name ?? "Conversation";
  };

  const convSubtitle = (c: Conversation) => {
    const others = c.participants.filter((p) => p.id !== myId);
    if (c.type === "group") return `${c.participants.length} people`;
    return others[0]?.role ?? "";
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            Chat
          </h1>
          <p className="text-muted-foreground mt-1">
            Direct messages and group conversations.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="shrink-0 gap-2 rounded-full">
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Conversation list */}
        <Card className="w-72 flex-shrink-0 border-none shadow-md rounded-2xl flex flex-col overflow-hidden">
          <div className="p-3 border-b bg-card">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Conversations
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations && conversations.length === 0 && (
              <div className="p-4">
                <p className="text-center text-muted-foreground text-sm">
                  No conversations yet.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 rounded-lg"
                  onClick={() => setDialogOpen(true)}
                >
                  Start one
                </Button>
              </div>
            )}
            {conversations?.map((c) => {
              const isSelected = c.id === selectedId;
              const other = c.participants.find((p) => p.id !== myId);
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-secondary/50 text-foreground"
                  }`}
                >
                  <Avatar className={`h-9 w-9 border ${isSelected ? "border-primary-foreground/30" : "border-border"}`}>
                    {c.type === "group" ? (
                      <AvatarFallback className="bg-primary/15 text-primary">
                        <Users className="h-4 w-4" />
                      </AvatarFallback>
                    ) : (
                      <>
                        <AvatarImage src={other?.imageUrl ?? undefined} />
                        <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                          {getInitials(other?.name)}
                        </AvatarFallback>
                      </>
                    )}
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{convTitle(c)}</p>
                    <p className={`text-xs truncate ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {c.lastMessage ?? convSubtitle(c)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Chat area */}
        <Card className="flex-1 border-none shadow-md rounded-2xl flex flex-col overflow-hidden min-h-0">
          {!activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
              <MessageSquare className="h-16 w-16 opacity-15" />
              <p className="font-medium">Select a conversation to start chatting.</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-5 py-3 border-b border-border/50 bg-card/50 flex items-center gap-3 shrink-0">
                <Avatar className="h-9 w-9 border border-border shadow-sm">
                  {activeConv.type === "group" ? (
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <Users className="h-4 w-4" />
                    </AvatarFallback>
                  ) : (
                    <>
                      <AvatarImage
                        src={activeConv.participants.find((p) => p.id !== myId)?.imageUrl ?? undefined}
                      />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {getInitials(convTitle(activeConv))}
                      </AvatarFallback>
                    </>
                  )}
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-none truncate">{convTitle(activeConv)}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5 truncate">
                    {activeConv.type === "group"
                      ? activeConv.participants.map((p) => p.name.split(" ")[0]).join(", ")
                      : convSubtitle(activeConv)}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoading ? (
                  <div className="space-y-4">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className={`flex ${i % 2 ? "justify-end" : "justify-start"}`}>
                        <Skeleton className={`h-10 rounded-2xl ${i % 2 ? "w-40" : "w-52"}`} />
                      </div>
                    ))}
                  </div>
                ) : messages?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                    <MessageSquare className="h-10 w-10 opacity-15" />
                    <p className="text-sm">No messages yet. Say hello!</p>
                  </div>
                ) : (
                  messages?.map((msg) => {
                    const isMe = msg.senderId === myId;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`flex items-end gap-2 max-w-[75%] ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={msg.senderImageUrl ?? undefined} />
                            <AvatarFallback className="text-[10px] font-bold">
                              {getInitials(msg.senderName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col gap-1">
                            {/* Show sender name in group chats for non-me messages */}
                            {!isMe && activeConv.type === "group" && (
                              <span className="text-[11px] font-semibold text-muted-foreground ml-1">
                                {msg.senderName}
                              </span>
                            )}
                            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                              isMe
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-secondary text-secondary-foreground rounded-bl-sm border border-border/50"
                            }`}>
                              {msg.content}
                            </div>
                            <span className={`text-[10px] text-muted-foreground ${isMe ? "text-right mr-1" : "ml-1"}`}>
                              {formatMsgTime(msg.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border/50 bg-background shrink-0">
                <form onSubmit={handleSend} className="flex gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${convTitle(activeConv)}…`}
                    className="flex-1 rounded-full px-5 h-11 bg-muted border-transparent focus-visible:ring-primary/50"
                    autoComplete="off"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={sendMutation.isPending || !draft.trim()}
                    className="h-11 w-11 rounded-full shadow-md shrink-0"
                  >
                    <Send className="h-4 w-4 ml-0.5" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </Card>
      </div>

      <NewConversationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        users={(users ?? []).filter((u) => u.id !== myId)}
        onCreated={(conv) => {
          queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
          setSelectedId(conv.id);
          setDialogOpen(false);
        }}
      />
    </div>
  );
}

function NewConversationDialog({
  open,
  onOpenChange,
  users,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  users: NonNullable<ReturnType<typeof useListUsers>["data"]>;
  onCreated: (conv: Conversation) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");

  // Reset selection whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setTitle("");
    }
  }, [open]);

  const isGroup = selected.size > 1;

  const createMutation = useMutation({
    mutationFn: () =>
      customFetch<Conversation>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({
          participantIds: Array.from(selected),
          title: isGroup && title.trim() ? title.trim() : undefined,
        }),
      }),
    onSuccess: onCreated,
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sorted = useMemo(
    () =>
      [...users].sort((a, b) => {
        // tutors first, then students, then parents
        const order: Record<string, number> = { tutor: 0, student: 1, parent: 2 };
        return (order[a.role ?? ""] ?? 3) - (order[b.role ?? ""] ?? 3);
      }),
    [users],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">
          Pick one person for a direct chat, or several for a group.
        </p>

        {isGroup && (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Group name (optional)"
            className="rounded-lg"
          />
        )}

        <div className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-1">
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground p-3 text-center">
              No one else to chat with yet.
            </p>
          )}
          {sorted.map((u) => {
            const isSel = selected.has(u.id);
            const name = userLabel(u);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left ${
                  isSel ? "bg-primary/10" : "hover:bg-muted"
                }`}
              >
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarImage src={u.profileImageUrl ?? undefined} />
                  <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{u.role}</p>
                </div>
                <span
                  className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                    isSel ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                  }`}
                >
                  {isSel && <Check className="h-3 w-3" />}
                </span>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={selected.size === 0 || createMutation.isPending}
            className="w-full rounded-lg"
          >
            {createMutation.isPending
              ? "Creating…"
              : isGroup
                ? `Create group (${selected.size})`
                : "Start chat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
