import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  backTo?: { to: string; label: string };
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, backTo, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0 space-y-1.5">
        {backTo ? (
          <Link
            to={backTo.to}
            className="inline-flex items-center gap-1.5 text-[16px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {backTo.label}
          </Link>
        ) : null}
        {eyebrow ? <p className="label-caps">{eyebrow}</p> : null}
        <h1 className="text-[30px] font-bold leading-[1.1] tracking-tight text-foreground sm:text-[32px]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-[17px] leading-[1.5] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:pt-1">{actions}</div>
      ) : null}
    </header>
  );
}
