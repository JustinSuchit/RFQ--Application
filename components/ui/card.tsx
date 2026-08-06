import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <section
      className={`rounded-md border border-[#dfe4ea] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] ${className}`}
    >
      {children}
    </section>
  );
}
