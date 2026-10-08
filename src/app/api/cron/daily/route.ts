import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculerScore } from "@/lib/matching";
import { genererCandidature } from "@/lib/candidature";
import { rechercherAdzuna, type OffreNormalisee } from "@/lib/adzuna";

const SEUIL_BROUILLON = 60;
const MAX_BROUILLONS = 10;

export const maxDuration = 60;

export async function GET(req: Request) {
  // Seul Vercel (ou toi, avec le secret) peut déclencher cette tâche
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: profils, error } = await admin.from("profiles").select("*");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const resume: Record<string, unknown>[] = [];

  for (const p of profils ?? []) {
    const mots = (p.job_types ?? "")
      .split(/[,;\n]/)
      .map((t: string) => t.trim())
      .filter(Boolean)
      .slice(0, 3);

    if (mots.length === 0 || !p.city) {
      resume.push({ profil: p.user_id, ignore: "types de jobs ou ville manquants" });
      continue;
    }

    // 1. Chercher les offres
    const parId = new Map<string, OffreNormalisee>();
    for (const mot of mots) {
      try {
        const offres = await rechercherAdzuna(mot, p.city);
        for (const o of offres) parId.set(o.id, o);
      } catch {
        // on continue avec les autres mots-clés
      }
    }

    // 2. Calculer les scores
    const profilMatching = {
      city: p.city ?? "",
      search_area: p.search_area ?? "",
      job_types: p.job_types ?? "",
      skills: p.skills ?? "",
      experience: p.experience ?? "",
      min_salary: p.min_salary ? Number(p.min_salary) : null,
        other_criteria: p.other_criteria ?? ""
    };
    const scorees = Array.from(parId.values())
      .map((o) => ({ ...o, ...calculerScore(profilMatching, o) }))
      .sort((a, b) => b.score - a.score);

    if (scorees.length === 0) {
      resume.push({ profil: p.user_id, offresTrouvees: 0, brouillons: 0 });
      continue;
    }

    // 3. Enregistrer les offres
    const { data: enregistrees, error: erreurOffres } = await admin
      .from("offers")
      .upsert(
        scorees.map((o) => ({
          user_id: p.user_id,
          source: "adzuna",
          external_id: o.id,
          title: o.titre,
          company: o.entreprise,
          description: o.description,
          location: o.lieu,
          contract: o.contrat,
          salary: o.salaire,
          published_at: o.datePublication || null,
          url: o.lien,
          match_score: o.score,
          match_reasons: o.raisons.join(" | "),
        })),
        { onConflict: "user_id,source,external_id" }
      )
      .select("id, external_id");

    if (erreurOffres) {
      resume.push({ profil: p.user_id, erreur: erreurOffres.message });
      continue;
    }

    const idParExterne = new Map<string, string>();
    for (const r of enregistrees ?? []) {
      idParExterne.set(String(r.external_id), String(r.id));
    }

    // 4. Préparer des brouillons pour les meilleures offres
    const candidates = scorees.filter((o) => o.score >= SEUIL_BROUILLON);
    const ids = candidates
      .map((o) => idParExterne.get(o.id))
      .filter((id): id is string => Boolean(id));

    let brouillons = 0;
    if (ids.length > 0) {
      const { data: existantes } = await admin
        .from("applications")
        .select("offer_id")
        .eq("user_id", p.user_id)
        .in("offer_id", ids);
      const deja = new Set((existantes ?? []).map((e) => e.offer_id as string));

      const aCreer = candidates
        .filter((o) => {
          const id = idParExterne.get(o.id);
          return id && !deja.has(id);
        })
        .slice(0, MAX_BROUILLONS)
        .map((o) => {
          const texte = genererCandidature(p, o);
          return {
            user_id: p.user_id,
            offer_id: idParExterne.get(o.id)!,
            cover_letter: texte.lettre,
            message: texte.message,
            status: "a_valider",
          };
        });

      if (aCreer.length > 0) {
        const { error: erreurApps } = await admin.from("applications").insert(aCreer);
        if (!erreurApps) brouillons = aCreer.length;
      }
    }

    resume.push({
      profil: p.user_id,
      offresTrouvees: scorees.length,
      brouillons,
    });
  }

  return NextResponse.json({ ok: true, resume });
}