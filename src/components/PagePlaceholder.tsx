import { forwardRef, ReactNode } from "react";
import { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  hint?: string;
  children?: ReactNode;
};

export const PagePlaceholder = forwardRef<HTMLDivElement, Props>(
  ({ icon: Icon, title, description, hint, children }, ref) => {
    return (
      <div ref={ref} className="container max-w-5xl py-10 sm:py-14 animate-fade-in">
        <div className="flex flex-col items-start gap-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>

          <div className="w-full rounded-xl border border-dashed border-border bg-surface-1/40 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {hint ?? "This page will come online in the next build phase."}
            </p>
            <p className="mt-2 text-[11px] uppercase tracking-widest font-mono text-muted-foreground/70">
              Phase 1A · scaffold only
            </p>
          </div>

          {children}
        </div>
      </div>
    );
  }
);

PagePlaceholder.displayName = "PagePlaceholder";
