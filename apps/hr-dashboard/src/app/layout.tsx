import type { Metadata } from "next";
import { ThemeProvider, ThemeScript } from "@repo/ui/theme";
import { Toaster } from "@repo/ui/toast";
import { firaCode, jakarta } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Intervue AI — Recruiter console",
    template: "%s · Intervue AI",
  },
  description: "Jobs, pipelines, candidates, AI interviews, scores and decisions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${firaCode.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
