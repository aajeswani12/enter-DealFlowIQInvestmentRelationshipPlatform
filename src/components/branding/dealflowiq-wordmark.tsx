import { cn } from "@/lib/utils";

type BrandSurface = "light" | "dark" | "adaptive";

interface DealflowIQWordmarkProps {
  variant?: BrandSurface;
  size?: number;
  className?: string;
}

/**
 * Shared DealflowIQ lockup. The accessible name is always exactly "DealflowIQ";
 * the split spans are visual only. Light surfaces use navy #101C32, dark
 * surfaces use warm white #FAFBFC, and IQ is always teal #18B8AA.
 */
export function DealflowIQWordmark({
  variant = "adaptive",
  size = 22,
  className,
}: DealflowIQWordmarkProps) {
  return (
    <span
      className={cn("dealflowiq-wordmark inline-flex items-baseline whitespace-nowrap leading-none", className)}
      data-variant={variant}
      role="img"
      aria-label="DealflowIQ"
      style={{
        fontSize: `${size}px`,
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <span
        aria-hidden="true"
        style={{ color: "var(--dealflowiq-ink)", fontWeight: 600, letterSpacing: "-0.035em" }}
      >
        Dealflow
      </span>
      <span
        aria-hidden="true"
        style={{ color: "#18B8AA", fontWeight: 600, letterSpacing: "-0.035em" }}
      >
        IQ
      </span>
    </span>
  );
}
