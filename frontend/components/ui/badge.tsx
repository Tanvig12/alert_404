import React from "react";

export type BadgeTone =
  | "p1"
  | "p2"
  | "p3"
  | "p4"
  | "ok"
  | "accent"
  | "dim"
  | "slate"
  | "red"
  | "amber"
  | "green"
  | "sky"
  | "violet";

const LEGACY: Record<string, BadgeTone> = {
  slate: "dim",
  red: "p1",
  amber: "p2",
  green: "ok",
  sky: "p3",
  violet: "accent",
};

export function Badge({
  children,
  tone = "dim",
  pulse = false,
  className = "",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  pulse?: boolean;
  className?: string;
}) {
  const t = LEGACY[tone] ?? tone;
  return (
    <span className={`soc-badge soc-badge-${t} ${className}`}>
      {pulse && (
        <span className="relative mr-1 flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-current" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}
