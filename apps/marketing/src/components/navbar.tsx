"use client";

import { motion } from "framer-motion";

export function Navbar() {
  return (
    <header className="border-b border-(--border)">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-(--accent)">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-(--accent-text)" />
          </span>

          <span className="text-[15px] font-medium tracking-tight">
            Intervue AI
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#product"
            className="text-[13px] text-(--text-secondary) transition-colors duration-200 hover:text-(--text-primary)"
          >
            Product
          </a>

          <a
            href="#pricing"
            className="text-[13px] text-(--text-secondary) transition-colors duration-200 hover:text-(--text-primary)"
          >
            Pricing
          </a>

          <a
            href="/docs"
            className="text-[13px] text-(--text-secondary) transition-colors duration-200 hover:text-(--text-primary)"
          >
            Docs
          </a>

          <motion.a
            href="#demo"
            whileHover={{ y: -1 }}
            transition={{ duration: 0.2 }}
            className="rounded-lg bg-(--accent) px-4 py-2 text-[13px] font-medium text-(--accent-text)"
          >
            Request a demo
          </motion.a>
        </nav>
      </div>
    </header>
  );
}