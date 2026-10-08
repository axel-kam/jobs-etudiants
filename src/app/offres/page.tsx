"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { calculerScore } from "@/lib/matching";

function PreparerCandidature({ offre }: { offre: OffreScoree }) {
  return (
    <a
      href={offre.lien || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
    >
      Préparer la candidature
    </a>
  );
}

type Offre = {
  id: string;
  titre: string;
  entreprise: string;
  description: string;
  lieu: string;
  contrat: string;
  horaires: string;
  salaire: string;
  datePublication: string;
  lien: string;
};

type OffreScoree = Offre & { score: number; raisons: string[] };

const SEUIL = 30;

function CarteOffre({ o, ecartee }: { o: OffreScoree; ecartee?: boolean }) {
  const couleur =
    o.score >= 70
      ? "bg-green-100 text-green-800"
      : o.score >= SEUIL
      ? "bg-amber-100 text-amber-800"
      : "bg-gray-100 text-gray-600";

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${
        ecartee ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">{o.titre}</h2>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${couleur}`}
        >
          {o.score} %
        </span>
      </div>
      <p className="text-sm text-gray-600">
        {o.entreprise} · {o.lieu}
      </p>
      <p className="mt-1 text-sm text-gray-600">
        {[o.contrat, o.horaires, o.salaire].filter(Boolean).join(" · ")}
      </p>
      <ul className="mt-3 space-y-1 text-sm text-gray-700">
        {o.raisons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="mt-3 line-clamp-3 text-sm text-gray-600">{o.description}</p>
            {o.lien && (
        <a
          href={o.lien}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm text-blue-600 hover:underline"
        >
          Voir l&apos;offre
        </a>
      )}
      <PreparerCandidature offre={o} />
    </div>
  );
}

export default function OffresPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [motsCles, setMotsCles] = useState("serveur");
  const [lieu, setLieu] = useState("Nanterre");
  const [offres, setOffres] = useState<OffreScoree[]>([]);
  const [afficherEcartees, setAfficherEcartees] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function rechercher(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return;
    }
    const userId = data.session.user.id;

    // Charger ton profil pour calculer les scores
    const { data: p } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!p) {
      setMessage("Remplis d'abord ton profil sur la page /profil.");
      setLoading(false);
      return;
    }

    const profil = {
      city: p.city ?? "",
      search_area: p.search_area ?? "",
      job_types: p.job_types ?? "",
      skills: p.skills ?? "",
      experience: p.experience ?? "",
      min_salary: p.min_salary ? Number(p.min_salary) : null,
          other_criteria: p.other_criteria ?? ""
    };

    const params = new URLSearchParams({ motsCles, lieu });
    const res = await fetch(`/api/offres?${params}`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    const json = await res.json();

    if (!res.ok) {
      setMessage(json.error ?? "Erreur");
      setOffres([]);
      setLoading(false);
      return;
    }

    const scorees: OffreScoree[] = (json.offres as Offre[])
      .map((o) => ({ ...o, ...calculerScore(profil, o) }))
      .sort((a, b) => b.score - a.score);

    setOffres(scorees);
    if (scorees.length === 0) setMessage("Aucune offre trouvée.");

    // Enregistrer les offres et leur score dans la base
    await supabase.from("offers").upsert(
      scorees.map((o) => ({
        user_id: userId,
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
    );

    setLoading(false);
  }

  const retenues = offres.filter((o) => o.score >= SEUIL);
  const ecartees = offres.filter((o) => o.score < SEUIL);

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900">Offres</h1>

        <form onSubmit={rechercher} className="mt-4 flex flex-wrap gap-3">
          <input
            value={motsCles}
            onChange={(e) => setMotsCles(e.target.value)}
            placeholder="Mots-clés (ex : serveur)"
            className="flex-1 rounded-lg border border-gray-300 p-2 text-gray-900"
          />
          <input
            value={lieu}
            onChange={(e) => setLieu(e.target.value)}
            placeholder="Ville"
            className="w-40 rounded-lg border border-gray-300 p-2 text-gray-900"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Recherche..." : "Rechercher"}
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-red-600">{message}</p>}

        {offres.length > 0 && (
          <p className="mt-4 text-sm text-gray-600">
            {retenues.length} offre(s) retenue(s), {ecartees.length} écartée(s)
            automatiquement (score sous {SEUIL} %).
          </p>
        )}

        <div className="mt-4 space-y-4">
          {retenues.map((o) => (
            <CarteOffre key={o.id} o={o} />
          ))}
        </div>

        {ecartees.length > 0 && (
          <label className="mt-6 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={afficherEcartees}
              onChange={(e) => setAfficherEcartees(e.target.checked)}
            />
            Afficher les offres écartées
          </label>
        )}

        {afficherEcartees && (
          <div className="mt-4 space-y-4">
            {ecartees.map((o) => (
              <CarteOffre key={o.id} o={o} ecartee />
            ))}
          </div>
        )}

        <p className="mt-8 text-xs text-gray-500">
          Offres fournies par{" "}
          <a
            href="https://www.adzuna.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Adzuna
          </a>
          .
        </p>
      </div>
    </main>
  );
}