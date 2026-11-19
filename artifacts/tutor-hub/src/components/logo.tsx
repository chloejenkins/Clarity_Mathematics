import type { CSSProperties } from "react";

/**
 * Clarity Mathematics mark: an app-icon tile (Apple blue, continuous-corner
 * square) holding an open "C" arc with a point at its centre, the idea of
 * a clear lens. The wordmark is set in the system font so it sits
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
      <path
        d="M43.5 22.2A15 15 0 1 0 43.5 41.8"
        fill="none"
        stroke="#fff"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle cx="32" cy="32" r="3.6" fill="#fff" />
    </svg>
  );
}
