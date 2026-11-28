import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/cn";
import { Spinner } from "./spinner";

export const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium select-none transition-[background-color,border-color,color,box-shadow] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-on-primary shadow-sm hover:bg-primary-hover",
        secondary:
          "border border-border-strong bg-surface text-fg shadow-sm hover:bg-surface-hover",
        outline: "border border-border-strong bg-transparent text-fg hover:bg-surface-hover",
        ghost: "bg-transparent text-muted-fg hover:bg-surface-hover hover:text-fg",
        destructive: "bg-danger text-on-danger shadow-sm hover:bg-danger-hover",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 rounded-md px-3 text-[13px] [&_svg]:size-3.5",
        md: "h-9 rounded-md px-4 text-sm [&_svg]:size-4",
        lg: "h-11 rounded-md px-5 text-[15px] [&_svg]:size-[18px]",
        icon: "size-9 rounded-md [&_svg]:size-4",
        "icon-sm": "size-8 rounded-md [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. a Next.js Link) with button styling. */
  asChild?: boolean;
  /** Shows a spinner, disables the button and keeps its width. */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, loading = false, disabled, children, type, ...props },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return (
      <Slot.Root ref={ref} className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-2">{children}</span>
          <span className="absolute inset-0 grid place-items-center">
            <Spinner />
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonProps, "size" | "asChild"> {
  /** Required: icon-only buttons need an accessible name. */
  "aria-label": string;
  size?: "sm" | "md";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = "md", variant = "ghost", ...props },
  ref,
) {
  return <Button ref={ref} variant={variant} size={size === "sm" ? "icon-sm" : "icon"} {...props} />;
});
