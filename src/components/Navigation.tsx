"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const liens = [
  { href: "/", libelle: "Tableau de bord" },
  { href: "/offres", libelle: "Offres" },
  { href: "/candidatures", libelle: "Candidatures" },
  { href: "/profil", libelle: "Profil" },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  if (pathname === "/login") return null;

  async function deconnexion() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav className="border-b border-gray-200 bg-white px-6 py-3">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-4">
        {liens.map((lien) => {
          const actif = pathname === lien.href;
          return (
            <Link
              key={lien.href}
              href={lien.href}
              className={`text-sm font-medium ${
                actif ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {lien.libelle}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={deconnexion}
          className="ml-auto text-sm text-gray-500 hover:underline"
        >
          Se déconnecter
        </button>
      </div>
    </nav>
  );
}