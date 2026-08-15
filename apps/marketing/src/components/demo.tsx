"use client";

import { motion } from "framer-motion";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { MonoLabel } from "@repo/ui/mono-label";

export function Demo() {
  return (
    <section
      id="demo"
      className="border-t border-(--border-subtle) px-6 py-20 md:py-24"
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="mx-auto max-w-150 text-center"
      >
        <MonoLabel accent>REQUEST A DEMO</MonoLabel>

        <h2 className="mt-3 text-[24px] font-medium leading-[1.3] tracking-[-0.02em] text-(--text-primary)">
          See structured screening in action.
        </h2>

        <p className="mx-auto mt-4 max-w-125 text-[14px] leading-6 text-(--text-secondary)">
          Tell us a little about your hiring workflow and we&apos;ll show you
          how Intervue AI can fit into it.
        </p>

        <form className="mx-auto mt-8 max-w-105 space-y-3">
          <Input type="text" placeholder="Your name" aria-label="Your name" />

          <Input
            type="email"
            placeholder="Work email"
            aria-label="Work email"
          />

          <Input type="text" placeholder="Company" aria-label="Company" />

          <Button type="button" className="mt-2 h-11 w-full">
            Request a demo
          </Button>
        </form>

        <p className="mt-4 font-mono text-[10px] text-(--text-muted)">
          Demo form — submissions are not connected yet.
        </p>
      </motion.div>
    </section>
  );
}
