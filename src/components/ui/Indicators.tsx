import type React from "react";

export type Tone = "neutral" | "ok" | "warn" | "danger" | "accent";

const dotTone: Record<Tone, string> = {
  neutral: "bg-faint",
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  accent: "bg-accent",
};

const textTone: Record<Tone, string> = {
  neutral: "text-muted",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  accent: "text-accent",
};

const softTone: Record<Tone, string> = {
  neutral: "bg-sunken text-muted border-edge",
  ok: "bg-ok-soft text-ok border-ok/30",
  warn: "bg-warn-soft text-warn border-warn/30",
  danger: "bg-danger-soft text-danger border-danger/30",
  accent: "bg-accent-soft text-accent border-accent/30",
};

/** A small state light. `pulse` marks a state that is actively in progress. */
export const StatusDot: React.FC<{ tone: Tone; pulse?: boolean }> = ({
  tone,
  pulse = false,
}) => (
  <span
    className={`inline-block h-[7px] w-[7px] shrink-0 rounded-full ${dotTone[tone]} ${
      pulse ? "animate-pulse" : ""
    }`}
  />
);

/** A dot paired with its label — the standard way status is stated in this app. */
export const StatusLine: React.FC<{
  tone: Tone;
  label: string;
  pulse?: boolean;
  className?: string;
}> = ({ tone, label, pulse = false, className = "" }) => (
  <span className={`inline-flex items-center gap-2 text-[13px] font-medium ${textTone[tone]} ${className}`}>
    <StatusDot tone={tone} pulse={pulse} />
    {label}
  </span>
);

/** A compact bordered chip. Used for discrete states, never for navigation. */
export const Badge: React.FC<{
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}> = ({ tone = "neutral", className = "", children }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-[3px] text-[11px] font-semibold ${softTone[tone]} ${className}`}
  >
    {children}
  </span>
);

/**
 * A labelled measurement. Values are monospaced and tabular so that a changing
 * digit never nudges the layout.
 */
export const Readout: React.FC<{
  label: string;
  value: React.ReactNode;
  unit?: string;
  tone?: Tone;
}> = ({ label, value, unit, tone = "neutral" }) => (
  <div className="flex flex-col gap-1">
    <span className="field-label">{label}</span>
    <span className={`tnum text-[15px] leading-none ${tone === "neutral" ? "text-ink" : textTone[tone]}`}>
      {value}
      {unit && <span className="ml-1 text-[11px] text-faint">{unit}</span>}
    </span>
  </div>
);

/** A horizontal bar for a bounded quantity. */
export const Meter: React.FC<{ fraction: number; tone?: Tone }> = ({
  fraction,
  tone = "accent",
}) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken">
    <div
      className={`h-full rounded-full transition-[width] duration-300 ${dotTone[tone]}`}
      style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }}
    />
  </div>
);

/** Centred placeholder for a panel with nothing to show yet. */
export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  hint?: string;
}> = ({ icon, title, hint }) => (
  <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
    {icon && <div className="text-faint">{icon}</div>}
    <p className="text-[13px] font-medium text-muted">{title}</p>
    {hint && <p className="max-w-xs text-xs leading-relaxed text-faint">{hint}</p>}
  </div>
);
