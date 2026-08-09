import type { CSSProperties } from "react";

/**
 * The Clarity Mathematics wordmark, rendered as crisp text so it stays legible
 * and sharp at any size and inherits color from its context (currentColor).
 * Size it by setting `fontSize` (via style) or a text-* class on the wrapper;
 * all internal sizing is in `em`, so it scales as one unit.
 */
export function Logo({
  className,
  style,
  showWordmark = true,
}: {
  className?: string;
  style?: CSSProperties;
  showWordmark?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center select-none leading-none ${className ?? ""}`}
      style={style}
      aria-label="Clarity Mathematics"
    >
      {/* Monogram: C | M */}
      <span
        className="font-display font-semibold inline-flex items-center"
        style={{ fontSize: "1.7em", letterSpacing: "0.01em" }}
      >
        <span>C</span>
        <span
          aria-hidden
          className="bg-current"
          style={{ width: "1.5px", height: "0.92em", margin: "0 0.14em", opacity: 0.35 }}
        />
        <span>M</span>
      </span>

      {showWordmark && (
        <span
          className="flex flex-col font-semibold uppercase"
          style={{ fontSize: "0.5em", letterSpacing: "0.19em", lineHeight: 1.18, marginLeft: "0.7em" }}
        >
          <span>Clarity</span>
          <span>Mathematics</span>
        </span>
      )}
    </span>
  );
}
