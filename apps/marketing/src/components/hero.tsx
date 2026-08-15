"use client";

import { motion } from "framer-motion";
import { MonoLabel } from "@repo/ui/mono-label";

export function Hero() {
  return (
    <section className="px-6 pb-20 pt-24 md:pb-28 md:pt-32">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mx-auto max-w-140 text-center"
      >
        <MonoLabel accent>MCP-NATIVE SCREENING</MonoLabel>

        <h1 className="text-[34px] font-medium leading-[1.2] tracking-[-0.03em] text-(--text-primary) md:text-[36px]">
          Screening interviews
          <br />
          that show their work
        </h1>

        <p className="mx-auto mt-5 max-w-125 text-[15px] leading-6 text-(--text-secondary)">
          Every question maps to a rubric. Every score has a reason. Every
          decision has a trail.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <motion.a
            href="#demo"
            whileHover={{ y: -1 }}
            transition={{ duration: 0.2 }}
            className="rounded-lg bg-(--accent) px-5 py-2.5 text-[13px] font-medium text-(--accent-text)"
          >
            Request a demo
          </motion.a>

          <motion.a
            href="#differentiator"
            whileHover={{ y: -1 }}
            transition={{ duration: 0.2 }}
            className="rounded-lg border border-(--border) px-5 py-2.5 text-[13px] text-(--text-secondary) transition-colors duration-200 hover:text-(--text-primary)"
          >
            See how scoring works
          </motion.a>
        </div>
      </motion.div>
    </section>
  );
}
