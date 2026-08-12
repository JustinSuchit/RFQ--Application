import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme/theme-provider";
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
  const themeInitScript = `
    (function() {
      try {
        var key = "procurementflow-theme";
        var preference = localStorage.getItem(key);
        if (preference !== "light" && preference !== "dark" && preference !== "system") {
          preference = "system";
        }
        var resolved = preference === "system"
          ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
          : preference;
        document.documentElement.dataset.theme = resolved;
        document.documentElement.dataset.themePreference = preference;
        document.documentElement.style.colorScheme = resolved;
      } catch (error) {
        document.documentElement.dataset.theme = "light";
        document.documentElement.dataset.themePreference = "system";
        document.documentElement.style.colorScheme = "light";
      }
    })();
  `;

  return (
    <html
      lang="en"
      className="h-full antialiased"
      data-theme="light"
      data-theme-preference="system"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
