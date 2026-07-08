import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Smaller footprint for tight spaces (sidebars, cards). */
  compact?: boolean;
  className?: string;
}

/**
 * Consistent "nothing here yet" state: dashed container, faded icon,
 * title, and optional supporting line. Used across pages so empty
 * screens share one visual language.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center border-2 border-dashed rounded-3xl text-muted-foreground",
        compact ? "py-8 px-4" : "py-20 px-6",
        className,
      )}
    >
      <Icon
        className={cn("mb-4 opacity-20", compact ? "h-10 w-10" : "h-16 w-16")}
        aria-hidden
      />
      <p className={cn("font-medium", compact ? "text-sm" : "text-lg")}>{title}</p>
      {description && (
        <p className="text-sm mt-1 opacity-80 max-w-xs">{description}</p>
      )}
    </div>
  );
}
