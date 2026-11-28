"use client";

import { createContext, useContext, useId, type AriaAttributes, type ReactNode } from "react";
import { Label as LabelPrimitive } from "radix-ui";
import { cn } from "./lib/cn";

interface FieldContextValue {
  id: string;
  hintId?: string;
  errorId?: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * Props a form control spreads to join its Field: id (for the label),
 * aria-describedby (hint + error) and aria-invalid. Explicit props win.
 */
export function useFieldControl<
  T extends {
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: AriaAttributes["aria-invalid"];
    required?: boolean;
  },
>(props: T): T {
  const field = useContext(FieldContext);
  if (!field) return props;
  const describedBy = [field.hintId, field.errorId, props["aria-describedby"]]
    .filter(Boolean)
    .join(" ");
  return {
    ...props,
    id: props.id ?? field.id,
    "aria-describedby": describedBy || undefined,
    "aria-invalid": props["aria-invalid"] ?? (field.invalid || undefined),
    required: props.required ?? (field.required || undefined),
  };
}

export function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn("text-sm font-medium leading-5 text-fg", className)}
      {...props}
    />
  );
}

interface FieldProps {
  label: ReactNode;
  /** Helper text shown under the control. */
  hint?: ReactNode;
  /** Error message; marks the control invalid and is announced. */
  error?: ReactNode;
  required?: boolean;
  /** Label sits beside the control (checkbox / switch rows). */
  inline?: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}

/** Visible label + hint + error wired to the control via context. */
export function Field({
  label,
  hint,
  error,
  required = false,
  inline = false,
  id,
  className,
  children,
}: FieldProps) {
  const autoId = useId();
  const controlId = id ?? `field-${autoId}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  const labelNode = (
    <Label htmlFor={controlId}>
      {label}
      {required && (
        <span className="ml-0.5 text-danger" aria-hidden>
          *
        </span>
      )}
    </Label>
  );

  return (
    <FieldContext.Provider
      value={{ id: controlId, hintId, errorId, invalid: Boolean(error), required }}
    >
      <div className={cn("flex flex-col gap-1.5", className)}>
        {inline ? (
          <div className="flex items-center gap-2.5">
            {children}
            {labelNode}
          </div>
        ) : (
          <>
            {labelNode}
            {children}
          </>
        )}
        {hint && !error && (
          <p id={hintId} className="text-[13px] leading-5 text-muted-fg">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-[13px] font-medium leading-5 text-danger">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}
