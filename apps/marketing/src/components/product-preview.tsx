"use client";

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";

export function ProductPreview() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(
    useTransform(mouseY, [-0.5, 0.5], [6, -6]),
    {
      stiffness: 180,
      damping: 20,
    },
  );

  const rotateY = useSpring(
    useTransform(mouseX, [-0.5, 0.5], [-6, 6]),
    {
      stiffness: 180,
      damping: 20,
    },
  );

  return (
    <section
      id="product"
      className="px-6 pb-24 md:pb-32"
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();

        mouseX.set((event.clientX - rect.left) / rect.width - 0.5);
        mouseY.set((event.clientY - rect.top) / rect.height - 0.5);
      }}
      onMouseLeave={() => {
        mouseX.set(0);
        mouseY.set(0);
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        style={{
          rotateX,
          rotateY,
          transformPerspective: 1200,
        }}
        className="mx-auto max-w-230"
      >
        {/* Browser */}
        <div className="product-preview-surface overflow-hidden rounded-xl">
          {/* Browser chrome */}
          <div className="flex h-11 items-center border-b border-(--border) bg-(--surface-elevated) px-4">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#3b404a]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#3b404a]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#3b404a]" />
            </div>

            <div className="mx-auto hidden h-6 w-70 items-center justify-center rounded-md border border-(--border) bg-(--surface-input) text-[10px] text-(--text-muted) sm:flex">
              candidate.intervue.ai/session
            </div>
          </div>

          {/* Product UI */}
          <div className="grid min-h-107.5 bg-(--surface) md:grid-cols-[190px_1fr]">
            {/* Sidebar */}
            <aside className="hidden border-r border-(--border) bg-[#11141b] p-5 md:block">
              <div className="font-mono text-[10px] text-(--accent)">
                INTERVUE AI
              </div>

              <div className="mt-8 space-y-5">
                <Stage label="Introduction" complete />
                <Stage label="Backend Fundamentals" active />
                <Stage label="System Design" />
                <Stage label="Wrap-up" />
              </div>
            </aside>

            {/* Conversation */}
            <div className="flex flex-col bg-[#151922]">
              {/* Header */}
              <div className="border-b border-(--border) bg-(--surface-elevated) px-5 py-4">
                <div className="text-[12px] text-(--text-muted)">
                  BACKEND ENGINEER · SCREENING
                </div>

                <div className="mt-1 text-[14px] font-medium text-(--text-primary)">
                  Backend Fundamentals
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-6 p-5 md:p-8">
                {/* Interviewer */}
                <div className="max-w-150">
                  <div className="mb-2 font-mono text-[10px] text-(--text-muted)">
                    INTERVIEWER
                  </div>

                  <div className="rounded-xl border border-(--border-strong) bg-[#0d1015] p-4 text-[13px] leading-6 text-(--text-secondary)">
                    You&apos;re building an API that needs to handle a large
                    number of concurrent requests. How would you approach
                    making the service reliable as traffic grows?
                  </div>
                </div>

                {/* Candidate */}
                <div className="ml-auto max-w-150">
                  <div className="mb-2 text-right font-mono text-[10px] text-(--text-muted)">
                    CANDIDATE
                  </div>

                  <div className="rounded-xl border border-(--border-strong) bg-[#181c24] p-4 text-[13px] leading-6 text-(--text-primary)">
                    I&apos;d start by keeping the API stateless so instances
                    can scale horizontally. Then I&apos;d look at connection
                    pooling, caching, and database indexing before introducing
                    more infrastructure.
                  </div>
                </div>

                {/* Evaluation */}
                <div className="flex items-center gap-2 font-mono text-[10px] text-(--text-muted)">
                  <span className="h-1.5 w-1.5 rounded-full bg-(--accent)" />

                  <span>Evaluating response against rubric...</span>
                </div>
              </div>

              {/* Input */}
              <div className="border-t border-(--border) bg-(--surface-elevated) p-4">
                <div className="flex items-center justify-between rounded-lg border border-(--border-strong) bg-(--surface-input) px-4 py-3">
                  <span className="text-[12px] text-(--text-muted)">
                    Your response
                  </span>

                  <span className="font-mono text-[10px] text-(--text-muted)">
                    02:14
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function Stage({
  label,
  active = false,
  complete = false,
}: {
  label: string;
  active?: boolean;
  complete?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full border text-[9px] ${
          active
            ? "border-(--accent) text-(--accent)"
            : complete
              ? "border-(--border-strong) text-(--text-secondary)"
              : "border-(--border) text-(--text-muted)"
        }`}
      >
        {complete ? "✓" : active ? "•" : ""}
      </span>

      <span
        className={`text-[11px] ${
          active
            ? "text-(--text-primary)"
            : "text-(--text-muted)"
        }`}
      >
        {label}
      </span>
    </div>
  );
}