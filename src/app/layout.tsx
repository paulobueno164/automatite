import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Automatite — automações sem código",
  description: "Crie automações em minutos: escolha um template ou descreva em linguagem natural e a IA monta o fluxo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
