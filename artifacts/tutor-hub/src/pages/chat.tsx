import { useState, useRef, useEffect } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useListMessages, useSendMessage, useListUsers } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, User as UserIcon } from "lucide-react";
import { format } from "date-fns";

export default function ChatPage() {
  const { user } = useAuth();
  const isTutor = user?.role === "tutor";
  const queryClient = useQueryClient();
  const sendMutation = useSendMessage();
  
  const { data: users } = useListUsers();
  
  // Find tutor ID if student
  const tutorId = users?.find(u => u.role === 'tutor')?.id;
  
  // State for selected user to chat with (Tutor selects student)
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  
  // Determine active conversation partner
  const activeChatPartnerId = isTutor ? selectedUserId : tutorId;

  const { data: messages, isLoading } = useListMessages(
    activeChatPartnerId ? { withUserId: activeChatPartnerId } : undefined,
    { query: { enabled: !!activeChatPartnerId } }
  );

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !activeChatPartnerId) return;

    sendMutation.mutate({
      data: { recipientId: activeChatPartnerId, content: draft }
    }, {
      onSuccess: () => {
        setDraft("");
        queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      }
    });
  };

  const students = users?.filter(u => u.role === 'student') || [];
  const activePartner = users?.find(u => u.id === activeChatPartnerId);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6">
      
      {/* Sidebar for Tutor to select students */}
      {isTutor && (
        <Card className="w-full md:w-80 flex-shrink-0 border-none shadow-md rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-slate-50 dark:bg-slate-900">
            <h2 className="font-bold font-display text-lg">Students</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {students.map(student => (
              <button
                key={student.id}
                onClick={() => setSelectedUserId(student.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                  selectedUserId === student.id 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "hover:bg-secondary/50 text-foreground"
                }`}
              >
                <Avatar className={`h-10 w-10 border ${selectedUserId === student.id ? "border-primary-foreground/30" : "border-border"}`}>
                  <AvatarImage src={student.profileImageUrl} />
                  <AvatarFallback className="bg-primary/20 text-primary">{student.firstName?.charAt(0) || "S"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <p className="font-bold text-sm truncate">{student.firstName} {student.lastName}</p>
                </div>
              </button>
            ))}
            {students.length === 0 && (
               <p className="text-center text-muted-foreground text-sm p-4">No students found.</p>
            )}
          </div>
        </Card>
      )}

      {/* Main Chat Area */}
      <Card className="flex-1 border-none shadow-md rounded-2xl flex flex-col overflow-hidden bg-white dark:bg-slate-950">
        {!activeChatPartnerId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">Select a conversation to start chatting</p>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-border/50 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-border shadow-sm">
                <AvatarImage src={activePartner?.profileImageUrl} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {activePartner?.firstName?.charAt(0) || <UserIcon className="h-5 w-5" />}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-bold text-base">{activePartner?.firstName} {activePartner?.lastName}</h2>
                <p className="text-xs text-muted-foreground">{activePartner?.role}</p>
              </div>
            </div>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6"
            >
              {isLoading ? (
                 <div className="flex justify-center p-4"><span className="animate-pulse">Loading messages...</span></div>
              ) : messages?.length === 0 ? (
                 <div className="text-center py-10 text-muted-foreground text-sm">No messages yet. Send a hello!</div>
              ) : (
                messages?.map((msg) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      <div className={`flex items-end gap-2 max-w-[80%] ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={msg.senderImageUrl} />
                          <AvatarFallback className="text-xs">{msg.senderName?.charAt(0) || "U"}</AvatarFallback>
                        </Avatar>
                        <div 
                          className={`p-3 md:p-4 rounded-2xl text-sm ${
                            isMe 
                              ? "bg-primary text-primary-foreground rounded-br-sm shadow-sm" 
                              : "bg-secondary text-secondary-foreground rounded-bl-sm border shadow-sm"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1 mx-10">
                        {format(new Date(msg.createdAt), "h:mm a")}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-background border-t border-border/50">
              <form onSubmit={handleSend} className="flex gap-3">
                <Input 
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 rounded-full px-6 h-12 bg-slate-100 dark:bg-slate-900 border-transparent focus-visible:ring-primary/50"
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  disabled={sendMutation.isPending || !draft.trim()}
                  className="h-12 w-12 rounded-full shadow-md hover-elevate shrink-0"
                >
                  <Send className="h-5 w-5 ml-1" />
                </Button>
              </form>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
