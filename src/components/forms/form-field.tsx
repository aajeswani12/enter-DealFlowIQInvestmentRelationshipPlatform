import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  hint,
  optional,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-[16px] font-medium text-foreground">
          {label}
          {optional ? <span className="ml-1.5 text-[14px] font-normal text-muted-foreground">Optional</span> : null}
        </Label>
      </div>
      {children}
      {hint ? <p className="text-[14px] leading-[1.5] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h3 className="text-[16px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h3>
        {description ? <p className="text-[14px] leading-[1.5] text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

interface ChipGroupProps {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  hint?: string;
}

export function ChipGroup({ label, options, selected, onChange, hint }: ChipGroupProps) {
  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[16px] font-medium text-foreground">{label}</span>
        <span className="text-[14px] text-muted-foreground">{hint}</span>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(option)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[16px] font-medium transition-colors",
                active
                  ? "border-brand/30 bg-brand-soft text-brand-strong"
                  : "border-border bg-card text-muted-foreground hover:border-brand/30 hover:text-foreground",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
