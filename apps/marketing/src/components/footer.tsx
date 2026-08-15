export function Footer() {
  return (
    <footer className="border-t border-(--border-subtle) px-6 py-8">
      <div className="mx-auto flex w-full max-w-230 flex-col items-center justify-between gap-5 sm:flex-row">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-(--accent)">
            <span className="text-[12px] font-medium text-(--accent-text)">
              I
            </span>
          </span>

          <span className="text-[13px] font-medium text-(--text-primary)">
            Intervue AI
          </span>
        </div>

        {/* Links */}
        <nav className="flex items-center gap-5">
          <a
            href="#product"
            className="text-[12px] text-(--text-muted) transition-colors duration-200 hover:text-(--text-primary)"
          >
            Product
          </a>

          <a
            href="#pricing"
            className="text-[12px] text-(--text-muted) transition-colors duration-200 hover:text-(--text-primary)"
          >
            Pricing
          </a>

          <a
            href="#"
            className="text-[12px] text-(--text-muted) transition-colors duration-200 hover:text-(--text-primary)"
          >
            Docs
          </a>
        </nav>

        {/* Copyright */}
        <div className="font-mono text-[10px] text-(--text-muted)">
          © 2026 Intervue AI
        </div>
      </div>
    </footer>
  );
}