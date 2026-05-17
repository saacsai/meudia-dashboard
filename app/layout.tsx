import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeuDIA",
  description: "Organizado e priorizado. Todo dia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
