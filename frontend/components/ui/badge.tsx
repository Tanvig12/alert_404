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
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  const t = LEGACY[tone] ?? tone;
  return <span className={`soc-badge soc-badge-${t}`}>{children}</span>;
}
