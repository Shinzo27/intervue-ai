import { Sparkles } from "lucide-react";

export function BrandMark({ subtitle }: { subtitle?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-lg bg-primary text-on-primary shadow-sm">
        <Sparkles className="size-[18px]" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-base font-bold tracking-tight text-fg">Intervue AI</span>
        {subtitle && <span className="block text-xs font-medium text-muted-fg">{subtitle}</span>}
      </span>
    </span>
  );
}
