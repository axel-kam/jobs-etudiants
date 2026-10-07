import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type OffreAdzuna = {
  id: string;
  title?: string;
  description?: string;
  created?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  contract_type?: string;
  contract_time?: string;
  salary_min?: number;
  salary_max?: number;
  redirect_url?: string;
};

function nettoyer(texte?: string) {
  return (texte ?? "").replace(/<[^>]*>/g, "");
}

function libelleContrat(o: OffreAdzuna) {
  const parts: string[] = [];
  if (o.contract_time === "full_time") parts.push("Temps plein");
  if (o.contract_time === "part_time") parts.push("Temps partiel");
  if (o.contract_type === "permanent") parts.push("CDI");
  if (o.contract_type === "contract") parts.push("Contrat");
  return parts.join(" · ");
}

function libelleSalaire(o: OffreAdzuna) {
  if (o.salary_min && o.salary_max) {
    return `${Math.round(o.salary_min)} – ${Math.round(o.salary_max)} € / an`;
  }
  if (o.salary_min) return `À partir de ${Math.round(o.salary_min)} € / an`;
  return "";
}

export async function GET(req: Request) {
  // 1. Vérifier que la personne est connectée
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!jwt) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  // 2. Préparer la recherche
  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID!,
    app_key: process.env.ADZUNA_APP_KEY!,
    results_per_page: "15",
  });
  const motsCles = searchParams.get("motsCles");
  const lieu = searchParams.get("lieu");
  if (motsCles) params.set("what", motsCles);
  if (lieu) params.set("where", lieu);

  // 3. Interroger Adzuna
  try {
    const res = await fetch(
      `https://api.adzuna.com/v1/api/jobs/fr/search/1?${params}`
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: `Adzuna a répondu ${res.status}` },
        { status: 502 }
      );
    }

    const json = await res.json();
    const offres = ((json.results ?? []) as OffreAdzuna[]).map((o) => ({
      id: String(o.id),
      titre: nettoyer(o.title),
      entreprise: o.company?.display_name ?? "Non précisée",
      description: nettoyer(o.description),
      lieu: o.location?.display_name ?? "",
      contrat: libelleContrat(o),
      horaires: "",
      salaire: libelleSalaire(o),
      datePublication: o.created ?? "",
      lien: o.redirect_url ?? "",
    }));

    return NextResponse.json({ offres });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}