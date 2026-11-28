import type { Metadata, Viewport } from "next";
import { ThemeProvider, ThemeScript } from "@repo/ui/theme";
import { firaCode, jakarta } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Your interview · Intervue AI",
  description: "Your AI-conducted interview.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${firaCode.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
