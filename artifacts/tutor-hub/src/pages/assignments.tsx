import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useListAssignments, useCreateAssignment, useDeleteAssignment } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { BookOpen, Calendar, Trash2, FileText, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  subject: z.string().optional(),
});

export default function AssignmentsPage() {
  const { user } = useAuth();
  const isTutor = user?.role === "tutor";
  
  const { data: assignments, isLoading } = useListAssignments();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createMutation = useCreateAssignment();
  const deleteMutation = useDeleteAssignment();

  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { title: "", description: "", subject: "", dueDate: "" }
  });

  const onSubmit = (values: z.infer<typeof createSchema>) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
        setIsOpen(false);
        form.reset();
        toast({ title: "Assignment created successfully!" });
      }
    });
  };

  const handleDelete = (id: number) => {
    if(confirm("Delete this assignment?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
          toast({ title: "Assignment deleted" });
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <BookOpen className="text-primary h-8 w-8" /> Assignments
          </h1>
          <p className="text-muted-foreground mt-1">Review homework and practice materials.</p>
        </div>
        
        {isTutor && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="rounded-xl shadow-md hover-elevate">
                <Plus className="mr-2 h-5 w-5"/> New Assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl">
              <DialogHeader>
                <DialogTitle>Post New Assignment</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl><Input placeholder="e.g. Chapter 4 Practice Set" className="rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="subject" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <FormControl><Input placeholder="e.g. Algebra" className="rounded-xl" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="dueDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl><Input type="date" className="rounded-xl" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description / Instructions</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Details..." className="rounded-xl min-h-[100px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full rounded-xl mt-4" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Posting..." : "Post Assignment"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
           {[1,2,3].map(i => <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {assignments?.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((assignment) => (
            <Card key={assignment.id} className="border-none shadow-md hover:shadow-lg transition-all duration-300 rounded-2xl overflow-hidden group">
              <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b pb-4 px-6 relative">
                {isTutor && (
                  <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(assignment.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-bold rounded-md uppercase tracking-wider">
                    {assignment.subject || "General"}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3"/> Posted {format(new Date(assignment.createdAt), "MMM d")}
                  </span>
                </div>
                <CardTitle className="text-xl font-bold leading-tight pr-8">{assignment.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex gap-3">
                  <div className="bg-secondary/30 p-3 rounded-xl h-fit text-secondary-foreground">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {assignment.description || "No additional instructions provided."}
                    </p>
                    
                    {assignment.dueDate && (
                      <div className="mt-4 inline-flex items-center gap-2 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-900/50 text-sm font-semibold">
                        <Calendar className="h-4 w-4" /> Due: {format(new Date(assignment.dueDate), "EEEE, MMM d, yyyy")}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {assignments?.length === 0 && (
             <div className="col-span-full text-center py-20 border-2 border-dashed rounded-3xl text-muted-foreground">
               <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-20" />
               <p className="text-lg">No assignments available yet.</p>
             </div>
          )}
        </div>
      )}
    </div>
  );
}
