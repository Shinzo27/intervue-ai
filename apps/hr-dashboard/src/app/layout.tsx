import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Intervue AI — Recruiter Dashboard",
  description: "Jobs, pipelines, candidates, AI interviews, scores and decisions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
