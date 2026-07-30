import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProcureFlow | RFQ SaaS Platform",
  description:
    "A generalized multi-tenant RFQ SaaS platform for managing requests, suppliers, customers, and quotes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
