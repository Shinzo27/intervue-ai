"use client";

import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "HR defines the pipeline",
    description:
      "Stages, questions, and rubric weights are configured once, with no code required.",
  },
  {
    number: "02",
    title: "Candidate has a real conversation",
    description:
      "The interview adapts naturally while keeping the conversation focused on the role.",
  },
  {
    number: "03",
    title: "A separate model scores it",
    description:
      "An isolated evaluator checks the candidate's responses against the defined rubric.",
  },
];

export function HowItWorks() {
  return (
    <section className="px-6 py-20 md:py-24">
      <div className="mx-auto max-w-230">
        {/* Section heading */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-10 max-w-150"
        >
          <div className="mb-3 font-mono text-[11px] text-(--accent)">
            HOW IT WORKS
          </div>

          <h2 className="text-[24px] font-medium leading-[1.3] tracking-[-0.02em] text-(--text-primary)">
            Structured where it matters.
          </h2>

          <p className="mt-3 max-w-130 text-[14px] leading-6 text-(--text-secondary)">
            A screening workflow designed around the parts of an interview
            that should be consistent, without turning the conversation into
            a form.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <motion.article
              key={step.number}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.5,
                delay: index * 0.09,
                ease: "easeOut",
              }}
              className="group rounded-xl border border-(--border) bg-(--surface) p-5 transition-[border-color,transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-(--border-strong) hover:shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
            >
              {/* Number */}
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-(--border-strong) font-mono text-[10px] text-(--text-secondary)">
                {step.number}
              </div>

              {/* Content */}
              <h3 className="mt-8 text-[15px] font-medium leading-5 text-(--text-primary)">
                {step.title}
              </h3>

              <p className="mt-2 text-[13px] leading-5.5 text-(--text-secondary)">
                {step.description}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}