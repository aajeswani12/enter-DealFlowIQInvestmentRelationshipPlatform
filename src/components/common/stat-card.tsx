import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  to?: string;
  className?: string;
}

export function StatCard({ label, value, hint, icon: Icon, to, className }: StatCardProps) {
  const content = (
    <div className={cn("panel group relative h-full p-5", to && "transition-shadow hover:shadow-lift", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="label-caps">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground/70" aria-hidden="true" />
      </div>
      <p className="metric mt-3 text-[34px]">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );

  if (!to) return content;

  return (
    <Link to={to} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      {content}
    </Link>
  );
}
