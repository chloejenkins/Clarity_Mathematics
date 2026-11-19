import type { CSSProperties } from "react";

/**
 * Clarity Mathematics mark: an app-icon tile (Apple blue, continuous-corner
 * square) holding a square-root sign with a "C" under it, drawn at one
 * stroke weight. The wordmark is set in the system font so it sits
 * naturally next to the rest of the interface. Sized in `em`: set
 * `fontSize` (style) or a text-* class on the wrapper to scale it.
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
      role="img"
      aria-label="Clarity Mathematics"
    >
      <LogoTile size="1.75em" />
      {showWordmark && (
        <span
          aria-hidden
          className="font-semibold tracking-[-0.01em] whitespace-nowrap"
          style={{ marginLeft: "0.55em", fontSize: "1em" }}
        >
          Clarity Mathematics
        </span>
      )}
    </span>
  );
}

export function LogoTile({ size = "2em" }: { size?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden
      className="shrink-0"
    >
      <defs>
        <linearGradient id="cm-tile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b8cff" />
          <stop offset="1" stopColor="#0062d1" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14.5" fill="url(#cm-tile)" />
      <g
        fill="none"
        stroke="#fff"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9.5 36L14.5 33.5L20.5 46.5L28.5 17.5H54" />
        <path d="M47.58 27.92A8.6 8.6 0 1 0 47.58 40.08" />
      </g>
    </svg>
  );
}
