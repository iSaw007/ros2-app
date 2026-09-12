import type React from "react";

type Variant = "default" | "primary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Stretches the button to the width of its container. */
  block?: boolean;
};

const variants: Record<Variant, string> = {
  default:
    "border-edge-strong bg-surface text-ink hover:bg-sunken disabled:hover:bg-surface",
  primary:
    "border-transparent bg-accent text-accent-fg hover:bg-accent-hover disabled:hover:bg-accent",
  danger:
    "border-transparent bg-danger text-white hover:bg-danger-hover disabled:hover:bg-danger",
  ghost:
    "border-transparent bg-transparent text-muted hover:bg-sunken hover:text-ink disabled:hover:bg-transparent",
};

const sizes: Record<Size, string> = {
  sm: "h-7 gap-1.5 px-2 text-xs",
  md: "h-9 gap-2 px-3 text-[13px]",
  lg: "h-11 gap-2 px-4 text-sm",
};

export const Button: React.FC<ButtonProps> = ({
  variant = "default",
  size = "md",
  block = false,
  className = "",
  children,
  ...rest
}) => (
  <button
    className={`inline-flex items-center justify-center rounded-[5px] border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
      variants[variant]
    } ${sizes[size]} ${block ? "w-full" : ""} ${className}`}
    {...rest}
  >
    {children}
  </button>
);

type IconButtonProps = ButtonProps & { label: string };

/** A square button whose only content is an icon. `label` is required. */
export const IconButton: React.FC<IconButtonProps> = ({
  label,
  variant = "default",
  className = "",
  children,
  ...rest
}) => (
  <button
    aria-label={label}
    title={label}
    className={`inline-flex h-8 w-8 items-center justify-center rounded-[5px] border transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`}
    {...rest}
  >
    {children}
  </button>
);
