"use client";

import { motion } from "framer-motion";

export function Differentiator() {
  return (
    <section className="border-y border-(--border-subtle) bg-(--surface) px-6 py-20 md:py-28">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="mx-auto max-w-170 text-center"
      >
        <div className="mb-4 font-mono text-[11px] text-(--accent)">
          WHY INTERVUE
        </div>

        <h2 className="text-[24px] font-medium leading-[1.3] tracking-[-0.02em] text-(--text-primary) md:text-[28px]">
          Every verdict has a paper trail.
        </h2>

        <p className="mx-auto mt-5 max-w-150 text-[14px] leading-6 text-(--text-secondary)">
          The model that conducts the interview isn&apos;t the model that decides
          how well it went. A separate evaluator checks every response against
          the predefined rubric, keeping the reasoning isolated and the final
          decision auditable.
        </p>

        <div className="mx-auto mt-8 flex max-w-125 flex-wrap items-center justify-center gap-2">
          <Signal label="INTERVIEW MODEL" />
          <span className="text-(--text-muted)">→</span>
          <Signal label="RESPONSE" />
          <span className="text-(--text-muted)">→</span>
          <Signal label="EVALUATOR" />
          <span className="text-(--text-muted)">→</span>
          <Signal label="AUDIT TRAIL" />
        </div>
      </motion.div>
    </section>
  );
}

function Signal({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-(--border) bg-(--surface-elevated) px-2.5 py-1.5 font-mono text-[10px] text-(--text-secondary)">
      {label}
    </span>
  );
}