import type React from "react";

type PanelProps = {
  /** Short upper-case heading. Omit for an unlabelled surface. */
  title?: string;
  /** Optional control aligned to the right of the title. */
  action?: React.ReactNode;
  /** Removes the body padding, for panels whose child manages its own edges. */
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
};

/**
 * The single surface primitive: a bordered rectangle with an optional titled
 * header. Everything in the app is built from these, at one border weight and
 * one radius, so the interface reads as a set of instrument panels rather than
 * a collection of floating cards.
 */
export const Panel: React.FC<PanelProps> = ({
  title,
  action,
  flush = false,
  className = "",
  children,
}) => (
  <section
    className={`flex flex-col rounded-[6px] border border-edge bg-surface ${className}`}
  >
    {(title || action) && (
      <header className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-edge px-3">
        {title && <h2 className="field-label">{title}</h2>}
        {action && <div className="flex items-center gap-1">{action}</div>}
      </header>
    )}
    <div className={flush ? "min-h-0 flex-1" : "min-h-0 flex-1 p-3"}>{children}</div>
  </section>
);
