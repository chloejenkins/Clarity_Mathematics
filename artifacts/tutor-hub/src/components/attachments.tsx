import { useRef, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Paperclip, Download, FileText, Loader2, Trash2, X } from "lucide-react";

export interface Attachment {
  id: number;
  assignmentId: number | null;
  uploadedBy: string;
  uploaderName: string;
  uploaderRole: string | null;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  note: string | null;
  createdAt: string;
  downloadUrl: string;
}

function formatBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Download through customFetch so the Clerk bearer token is attached. */
export async function downloadAttachment(att: Pick<Attachment, "id" | "filename">) {
  const blob = await customFetch<Blob>(`/api/uploads/${att.id}/download`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = att.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function FileUploadButton({
  assignmentId,
  label = "Attach a file",
  onUploaded,
}: {
  assignmentId?: number;
  label?: string;
  onUploaded?: (att: Attachment) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (assignmentId != null) fd.append("assignmentId", String(assignmentId));
      const att = await customFetch<Attachment>("/api/uploads", {
        method: "POST",
        body: fd,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/uploads"] });
      onUploaded?.(att);
      toast({ title: "File uploaded", description: file.name });
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      toast({
        title: "Upload failed",
        description: msg.toLowerCase().includes("too large")
          ? "File too large (max 15 MB)."
          : "Allowed: PDF, images, Office docs, text, zip — under 15 MB.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="gap-2 rounded-lg"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
        {uploading ? "Uploading…" : label}
      </Button>
    </>
  );
}

function AttachmentRow({
  att,
  canDelete,
  showUploader,
}: {
  att: Attachment;
  canDelete?: boolean;
  showUploader?: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const onDownload = async () => {
    try {
      await downloadAttachment(att);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const onDelete = async () => {
    setBusy(true);
    try {
      await customFetch(`/api/uploads/${att.id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["/api/uploads"] });
    } catch {
      toast({ title: "Could not delete file", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{att.filename}</p>
        <p className="text-xs text-muted-foreground truncate">
          {showUploader && att.uploaderName ? `${att.uploaderName} · ` : ""}
          {formatBytes(att.sizeBytes)}
          {att.note ? ` · ${att.note}` : ""}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        title="Download"
        onClick={onDownload}
      >
        <Download className="h-4 w-4" />
      </Button>
      {canDelete && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          title="Remove"
          disabled={busy}
          onClick={onDelete}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}

export function AttachmentList({
  assignmentId,
  directOnly,
  showUploader,
  canDelete,
  emptyText,
}: {
  assignmentId?: number;
  /** When true, show only files not tied to an assignment (direct sends). */
  directOnly?: boolean;
  showUploader?: boolean;
  canDelete?: boolean;
  emptyText?: string;
}) {
  const qs = assignmentId != null ? `?assignmentId=${assignmentId}` : "";
  const { data } = useQuery({
    queryKey: ["/api/uploads", assignmentId ?? (directOnly ? "direct" : "all")],
    queryFn: () => customFetch<Attachment[]>(`/api/uploads${qs}`),
  });

  let items = data ?? [];
  if (directOnly) items = items.filter((a) => a.assignmentId == null);

  if (items.length === 0) {
    return emptyText ? (
      <p className="text-xs text-muted-foreground">{emptyText}</p>
    ) : null;
  }

  return (
    <div className="space-y-1.5">
      {items.map((a) => (
        <AttachmentRow
          key={a.id}
          att={a}
          showUploader={showUploader}
          canDelete={canDelete}
        />
      ))}
    </div>
  );
}
