// Íconos SVG inline (estilo outline), sin dependencias. Heredan color (currentColor) y tamaño (em).
import type { CSSProperties } from "react";

const PATHS: Record<string, string> = {
  box: "M12 3 4 7v10l8 4 8-4V7l-8-4Z M4 7l8 4 8-4 M12 11v10",
  check: "M5 12l4.5 4.5L19 7",
  rocket: "M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M9 13l-3-1 6-7c2.5-2.5 6-3 6-3s-.5 3.5-3 6l-7 6-1-3Z M14 6.5a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 0 0-2.4 0Z",
  alert: "M12 4 2.5 20h19L12 4Z M12 10v4 M12 17.5h.01",
  star: "M12 4l2.5 5 5.5.8-4 3.9.9 5.5L12 22.4 7.1 19.2 8 13.7 4 9.8l5.5-.8L12 4Z",
  sparkles: "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4Z M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z",
  printer: "M7 9V4h10v5 M7 17H5a1 1 0 0 1-1-1v-4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4a1 1 0 0 1-1 1h-2 M8 14h8v6H8v-6Z",
};

export function Icon({
  name,
  className = "",
  style,
}: {
  name: keyof typeof PATHS | string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d={PATHS[name] ?? PATHS.box} />
    </svg>
  );
}
