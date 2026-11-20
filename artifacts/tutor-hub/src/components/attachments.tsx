import { useRef, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Paperclip, Download, FileText, Loader2, Upload, X } from "lucide-react";

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

/** Uploads one or more files, optionally onto an assignment. */
function useUploader(assignmentId?: number, onUploaded?: (att: Attachment) => void) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const upload = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    const done: string[] = [];
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        if (assignmentId != null) fd.append("assignmentId", String(assignmentId));
        const att = await customFetch<Attachment>("/api/uploads", {
          method: "POST",
          body: fd,
        });
        done.push(file.name);
        onUploaded?.(att);
      }
      toast(
        done.length === 1
          ? { title: "File uploaded", description: done[0] }
          : { title: `${done.length} files uploaded` },
      );
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      toast({
        title: done.length ? `Uploaded ${done.length}, then one failed` : "Upload failed",
        description: msg.toLowerCase().includes("too large")
          ? "File too large (max 15 MB)."
          : "Allowed: PDF, images, Office docs, text, zip, under 15 MB.",
        variant: "destructive",
      });
    } finally {
      queryClient.invalidateQueries({ queryKey: ["/api/uploads"] });
      setUploading(false);
    }
  };

  return { upload, uploading };
}

function HiddenFileInput({ inputRef, onFiles }: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (files: File[]) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      multiple
      className="hidden"
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = "";
        onFiles(files);
      }}
    />
  );
}

export function FileUploadButton({
  assignmentId,
  label = "Attach a file",
  onUploaded,
  quiet = false,
}: {
  assignmentId?: number;
  label?: string;
  onUploaded?: (att: Attachment) => void;
  /** A plain text button, for secondary places like the tutor's worksheet link. */
  quiet?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useUploader(assignmentId, onUploaded);

  return (
    <>
      <HiddenFileInput inputRef={inputRef} onFiles={upload} />
      <Button
        type="button"
        variant={quiet ? "ghost" : "outline"}
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={quiet ? "gap-2 rounded-lg text-primary -ml-2" : "gap-2 rounded-lg"}
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

/**
 * A large tap (or drop) target for adding work: photos of written working,
 * PDFs or documents. Takes several files at once.
 */
export function FileDropZone({
  assignmentId,
  title = "Add photos or files",
  hint = "Photos of your working, PDFs or documents, up to 15 MB each",
}: {
  assignmentId?: number;
  title?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useUploader(assignmentId);
  const [over, setOver] = useState(false);

  return (
    <>
      <HiddenFileInput inputRef={inputRef} onFiles={upload} />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          upload(Array.from(e.dataTransfer.files));
        }}
        className={
          "w-full flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 text-left transition-colors " +
          (over ? "border-primary bg-primary/5" : "border-border hover:border-primary/60 hover:bg-primary/5")
        }
      >
        <span className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-primary">{uploading ? "Uploading…" : title}</span>
          <span className="block text-xs text-muted-foreground">{hint}</span>
        </span>
      </button>
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
    <div data-card="" className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2">
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

/** Files the current user can see, optionally on one assignment. */
export function useAttachments(assignmentId?: number, directOnly?: boolean) {
  const qs = assignmentId != null ? `?assignmentId=${assignmentId}` : "";
  return useQuery({
    queryKey: ["/api/uploads", assignmentId ?? (directOnly ? "direct" : "all")],
    queryFn: () => customFetch<Attachment[]>(`/api/uploads${qs}`),
  });
}

export function AttachmentList({
  assignmentId,
  directOnly,
  showUploader,
  canDelete,
  emptyText,
  from,
}: {
  assignmentId?: number;
  /** When true, show only files not tied to an assignment (direct sends). */
  directOnly?: boolean;
  /** Only the tutor's worksheets, or only the family's own files. */
  from?: "tutor" | "family";
  showUploader?: boolean;
  canDelete?: boolean;
  emptyText?: string;
}) {
  const { data } = useAttachments(assignmentId, directOnly);

  let items = data ?? [];
  if (directOnly) items = items.filter((a) => a.assignmentId == null);
  if (from) items = items.filter((a) => (a.uploaderRole === "tutor") === (from === "tutor"));

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
