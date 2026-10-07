import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Mes jobs étudiants",
  description: "Recherche et suivi de candidatures à des jobs étudiants",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <Navigation />
        {children}
      </body>
    </html>
  );
}