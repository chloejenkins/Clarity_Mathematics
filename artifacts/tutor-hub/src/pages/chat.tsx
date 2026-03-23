import { useState, useRef, useEffect } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useListMessages, useSendMessage, useListUsers } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, MessageSquare } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";

function formatMsgTime(dateStr: string | Date) {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`;
  return format(date, "MMM d, h:mm a");
}

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function ChatPage() {
  const { user } = useAuth();
  const isTutor = user?.role === "tutor";
  const queryClient = useQueryClient();
  const sendMutation = useSendMessage();

  const { data: users } = useListUsers();
  const students = users?.filter(u => u.role === "student") ?? [];
  const tutorUser = users?.find(u => u.role === "tutor");

  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);

  // Students always chat with the tutor
  const activeChatPartnerId = isTutor ? selectedUserId : tutorUser?.id;

  // Auto-select first student for tutor
  useEffect(() => {
    if (isTutor && !selectedUserId && students.length > 0) {
      setSelectedUserId(students[0].id);
    }
  }, [isTutor, students, selectedUserId]);

  const { data: messages, isLoading } = useListMessages(
    activeChatPartnerId ? { withUserId: activeChatPartnerId } : undefined,
    {
      query: {
        enabled: !!activeChatPartnerId,
        refetchInterval: 4000, // Poll every 4 seconds for new messages
      }
    }
  );

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !activeChatPartnerId) return;
    sendMutation.mutate(
      { data: { recipientId: activeChatPartnerId, content: draft.trim() } },
      {
        onSuccess: () => {
          setDraft("");
          queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  };

  const activePartner = users?.find(u => u.id === activeChatPartnerId);
  const partnerName = activePartner
    ? [activePartner.firstName, activePartner.lastName].filter(Boolean).join(" ") || activePartner.username || "User"
    : "";

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <div className="mb-4">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-primary" />
          Chat
        </h1>
        <p className="text-muted-foreground mt-1">
          {isTutor ? "Private conversations with each student." : "Your private channel with your tutor."}
        </p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Student list — tutor only */}
        {isTutor && (
          <Card className="w-64 flex-shrink-0 border-none shadow-md rounded-2xl flex flex-col overflow-hidden">
            <div className="p-3 border-b bg-card">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Students</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {students.length === 0 && (
                <p className="text-center text-muted-foreground text-sm p-4">No students yet.</p>
              )}
              {students.map(student => {
                const name = [student.firstName, student.lastName].filter(Boolean).join(" ") || student.username || "Student";
                const isSelected = selectedUserId === student.id;
                return (
                  <button
                    key={student.id}
                    onClick={() => setSelectedUserId(student.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-secondary/50 text-foreground"
                    }`}
                  >
                    <Avatar className={`h-9 w-9 border ${isSelected ? "border-primary-foreground/30" : "border-border"}`}>
                      <AvatarImage src={student.profileImageUrl ?? undefined} />
                      <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                        {getInitials(name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm truncate">{name}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Chat area */}
        <Card className="flex-1 border-none shadow-md rounded-2xl flex flex-col overflow-hidden min-h-0">
          {!activeChatPartnerId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
              <MessageSquare className="h-16 w-16 opacity-15" />
              <p className="font-medium">Select a student to open their chat.</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-5 py-3 border-b border-border/50 bg-card/50 flex items-center gap-3 shrink-0">
                <Avatar className="h-9 w-9 border border-border shadow-sm">
                  <AvatarImage src={activePartner?.profileImageUrl ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {getInitials(partnerName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-sm leading-none">{partnerName}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">{activePartner?.role}</p>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoading ? (
                  <div className="flex justify-center pt-10 text-muted-foreground text-sm animate-pulse">Loading messages…</div>
                ) : messages?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                    <MessageSquare className="h-10 w-10 opacity-15" />
                    <p className="text-sm">No messages yet. Say hello!</p>
                  </div>
                ) : (
                  messages?.map(msg => {
                    const isMe = msg.senderId === user?.id;
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
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${partnerName}…`}
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
    </div>
  );
}
