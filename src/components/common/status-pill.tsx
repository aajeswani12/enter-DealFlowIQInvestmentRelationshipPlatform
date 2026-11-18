import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "navy";

const TONES: Record<Tone, string> = {
  neutral: "border-border bg-secondary/70 text-secondary-foreground",
  brand: "border-brand/25 bg-brand-soft text-brand-strong",
  success: "border-success/20 bg-success-soft text-success",
  warning: "border-warning/25 bg-warning-soft text-warning",
  danger: "border-destructive/20 bg-danger-soft text-destructive",
  navy: "border-primary/15 bg-primary/5 text-primary",
};

const DOTS: Record<Tone, string> = {
  neutral: "bg-muted-foreground/60",
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  navy: "bg-primary",
};

interface PillProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

export function Pill({ tone = "neutral", dot = false, children, className }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5 tracking-tight",
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

const CASE_TONES: Record<string, Tone> = {
  sourcing: "neutral",
  diligence: "brand",
  ic_review: "warning",
  term_sheet: "navy",
  invested: "success",
  passed: "neutral",
};

export function CaseStatusPill({ status, label }: { status: string; label: string }) {
  return (
    <Pill tone={CASE_TONES[status] ?? "neutral"} dot>
      {label}
    </Pill>
  );
}

const CAPTURE_TONES: Record<string, Tone> = {
  new: "brand",
  reviewing: "warning",
  promoted: "success",
  archived: "neutral",
};

export function CaptureStatusPill({ status, label }: { status: string; label: string }) {
  return <Pill tone={CAPTURE_TONES[status] ?? "neutral"}>{label}</Pill>;
}

const RELATIONSHIP_TONES: Record<string, Tone> = {
  active: "success",
  warm: "brand",
  new: "neutral",
  dormant: "neutral",
};

export function RelationshipPill({ status, label }: { status: string; label: string }) {
  return <Pill tone={RELATIONSHIP_TONES[status] ?? "neutral"}>{label}</Pill>;
}

const OUTREACH_TONES: Record<string, Tone> = {
  draft: "neutral",
  approved: "brand",
  sent: "success",
};

export function OutreachStatusPill({ status, label }: { status: string; label: string }) {
  return <Pill tone={OUTREACH_TONES[status] ?? "neutral"}>{label}</Pill>;
}

export function TierPill({ tier, label }: { tier: "strong" | "considered" | "weak"; label: string }) {
  const tone: Tone = tier === "strong" ? "success" : tier === "considered" ? "brand" : "neutral";
  return <Pill tone={tone}>{label}</Pill>;
}
