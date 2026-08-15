"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const plans = [
  {
    name: "Screening",
    description:
      "Structured AI screening for teams that want consistent candidate evaluation.",
    monthly: "$49",
    annual: "$39",
    recommended: false,
    features: [
      "Unlimited job pipelines",
      "Custom screening questions",
      "Rubric-based evaluation",
      "Candidate interview links",
      "Audit-ready decisions",
    ],
  },
  {
    name: "Screening + Voice",
    description:
      "Everything in Screening, with conversational voice interviews for deeper assessment.",
    monthly: "$99",
    annual: "$79",
    recommended: true,
    features: [
      "Everything in Screening",
      "Voice-based interviews",
      "Conversation transcripts",
      "Two-model scoring",
      "Priority support",
    ],
  },
];

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section
      id="pricing"
      className="w-full border-t border-(--border-subtle) px-6 py-24 md:py-28"
    >
      <div className="mx-auto flex w-full max-w-230 flex-col items-center">
        {/* Section heading */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="flex w-full flex-col items-center text-center"
        >
          <div className="font-mono text-[11px] tracking-[0.08em] text-(--accent)">
            PRICING
          </div>

          <h2 className="mx-auto mt-3 max-w-180 text-[26px] font-medium leading-tight tracking-tight text-(--text-primary) md:text-[30px]">
            Simple pricing for structured screening.
          </h2>

          <p className="mx-auto mt-4 max-w-160 text-[14px] leading-6 text-(--text-secondary)">
            Start with structured screening and add voice when your hiring
            workflow needs it.
          </p>

          {/* Billing toggle */}
          <div className="mt-7 inline-flex rounded-lg border border-(--border) bg-(--surface) p-1">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`rounded-md px-5 py-2 text-[12px] transition-all duration-200 ease-out ${
                !annual
                  ? "bg-(--surface-elevated) text-(--text-primary)"
                  : "text-(--text-muted) hover:text-(--text-secondary)"
              }`}
            >
              Monthly
            </button>

            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`rounded-md px-5 py-2 text-[12px] transition-all duration-200 ease-out ${
                annual
                  ? "bg-(--surface-elevated) text-(--text-primary)"
                  : "text-(--text-muted) hover:text-(--text-secondary)"
              }`}
            >
              Annual
            </button>
          </div>

          {/* Disclaimer */}
          <div className="mt-4 font-mono text-[10px] text-(--text-muted)">
            Illustrative pricing for demo purposes
          </div>
        </motion.div>

        {/* Pricing cards */}
        <div className="mt-12 grid w-full max-w-215 gap-5 md:grid-cols-2">
          {plans.map((plan, index) => (
            <motion.article
              key={plan.name}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.5,
                delay: index * 0.08,
                ease: "easeOut",
              }}
              className={`flex flex-col rounded-xl border bg-(--surface) p-6 transition-all duration-200 ease-out hover:-translate-y-0.5 ${
                plan.recommended
                  ? "border-(--accent)"
                  : "border-(--border)"
              }`}
            >
              {/* Plan header */}
              <div className="flex min-h-21 items-start justify-between gap-4">
                <div>
                  <h3 className="text-[16px] font-medium text-(--text-primary)">
                    {plan.name}
                  </h3>

                  <p className="mt-2 max-w-85 text-[13px] leading-5 text-(--text-secondary)">
                    {plan.description}
                  </p>
                </div>

                {plan.recommended && (
                  <span className="shrink-0 rounded-md bg-(--accent) px-2 py-1 font-mono text-[9px] leading-none text-(--accent-text)">
                    RECOMMENDED
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="mt-6">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[30px] leading-none tracking-[-0.03em] text-(--text-primary)">
                    {annual ? plan.annual : plan.monthly}
                  </span>

                  <span className="text-[12px] text-(--text-muted)">
                    / month
                  </span>
                </div>

                <div className="mt-2 h-4 font-mono text-[10px] text-(--text-muted)">
                  {annual ? "Billed annually" : ""}
                </div>
              </div>

              {/* Divider */}
              <div className="my-6 border-t border-(--border)" />

              {/* Features */}
              <ul className="space-y-3.5">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-[13px] leading-5 text-(--text-secondary)"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-(--accent)" />

                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="mt-auto pt-8">
                <button
                  type="button"
                  className={`w-full rounded-lg px-4 py-3 text-[13px] transition-all duration-200 ease-out hover:-translate-y-px ${
                    plan.recommended
                      ? "bg-(--accent) text-(--accent-text) hover:brightness-105"
                      : "border border-(--border-strong) text-(--text-primary) hover:bg-(--surface-elevated)"
                  }`}
                >
                  Request a demo
                </button>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}