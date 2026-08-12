import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  accent?: "none" | "top" | "side" | "soft";
};

export function Card({ children, className = "", accent = "none" }: CardProps) {
  const accentClass = {
    none: "",
    top: "border-t-2 border-t-[var(--page-accent)]",
    side: "border-l-2 border-l-[var(--page-accent)]",
    soft: "bg-[var(--page-accent-soft)] border-[var(--page-accent-border)]",
  }[accent];

  return (
    <section
      className={`rounded-md border border-[var(--border-default)] bg-[var(--surface)] shadow-[0_1px_2px_var(--shadow-color)] ${accentClass} ${className}`}
    >
      {children}
    </section>
  );
}
