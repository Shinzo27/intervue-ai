import type { HTMLAttributes, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/cn";

const alertVariants = cva("flex gap-3 rounded-lg border p-4 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0", {
  variants: {
    variant: {
      info: "border-primary/25 bg-primary-subtle text-fg [&>svg]:text-primary",
      success: "border-success/25 bg-success-subtle text-fg [&>svg]:text-success",
      warning: "border-warning/30 bg-warning-subtle text-fg [&>svg]:text-warning",
      danger: "border-danger/25 bg-danger-subtle text-fg [&>svg]:text-danger",
    },
  },
  defaultVariants: { variant: "info" },
});

const icons = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle };

export interface AlertProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof alertVariants> {
  title?: ReactNode;
  action?: ReactNode;
}

export function Alert({ className, variant, title, action, children, ...props }: AlertProps) {
  const Icon = icons[variant ?? "info"];
  return (
    <div
      role={variant === "danger" || variant === "warning" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon aria-hidden />
      <div className="flex-1 space-y-1">
        {title && <p className="font-semibold leading-5">{title}</p>}
        {children && <div className="leading-5 text-muted-fg">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
