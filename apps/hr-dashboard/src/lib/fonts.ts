import localFont from "next/font/local";

/*
 * Self-hosted from @fontsource-variable (no network needed at build time,
 * so Docker builds work offline). next/font still generates a size-adjusted
 * fallback, so there is no layout shift while the font loads.
 */

/** UI and headings (exposed as --font-jakarta, consumed by the tokens). */
export const jakarta = localFont({
  src: "../../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2",
  weight: "200 800",
  variable: "--font-jakarta",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
});

/** Scores, IDs, tokens and timestamps (exposed as --font-fira). */
export const firaCode = localFont({
  src: "../../node_modules/@fontsource-variable/fira-code/files/fira-code-latin-wght-normal.woff2",
  weight: "300 700",
  variable: "--font-fira",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
  adjustFontFallback: false,
});
