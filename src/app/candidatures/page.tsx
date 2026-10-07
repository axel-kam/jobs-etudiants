"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Candidature = {
  id: string;
  cover_letter: string | null;
  message: string | null;
  status: string;
  offers: {
    title: string | null;
    company: string | null;
    location: string | null;
    url: string | null;
  } | null;
};

const STATUTS: Record<string, string> = {
  a_valider: "À valider",
  validee: "Validée (prête à envoyer)",
  envoyee: "Envoyée",
};

export default function CandidaturesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState<Candidature[]>([]);
  const [filtre, setFiltre] = useState("tous");
  const [selection, setSelection] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const charger = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push("/login");
      return;
    }
    const { data, error } = await supabase
      .from("applications")
      .select("id, cover_letter, message, status, offers(title, company, location, url)")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Erreur : ${error.message}`);
    } else {
      setItems((data ?? []) as unknown as Candidature[]);
    }
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    charger();
  }, [charger]);

  function modifier(id: string, champs: Partial<Candidature>) {
    setItems((courant) =>
      courant.map((c) => (c.id === id ? { ...c, ...champs } : c))
    );
  }

  async function appliquer(ids: string[], statut?: string) {
    setMessage("");
    const aTraiter = items.filter((c) => ids.includes(c.id));

    if (statut === "validee") {
      const vide = aTraiter.find((c) => !(c.cover_letter ?? "").trim());
      if (vide) {
        setMessage("Une candidature a une lettre vide : complète-la avant de valider.");
        return;
      }
    }

    const resultats = await Promise.all(
      aTraiter.map((c) =>
        supabase
          .from("applications")
          .update({
            cover_letter: c.cover_letter,
            message: c.message,
            ...(statut ? { status: statut } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("id", c.id)
      )
    );

    const erreur = resultats.find((r) => r.error);
    if (erreur?.error) {
      setMessage(`Erreur : ${erreur.error.message}`);
      return;
    }

    if (statut) {
      setItems((courant) =>
        courant.map((c) => (ids.includes(c.id) ? { ...c, status: statut } : c))
      );
      setSelection((s) => s.filter((id) => !ids.includes(id)));
    }
    setMessage(statut ? "Statut mis à jour." : "Modifications enregistrées.");
  }

  async function copier(texte: string | null) {
    try {
      await navigator.clipboard.writeText(texte ?? "");
      setMessage("Copié dans le presse-papiers.");
    } catch {
      setMessage("Impossible de copier : sélectionne le texte et fais Ctrl + C.");
    }
  }

  function basculer(id: string) {
    setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const affichees = items.filter((c) => filtre === "tous" || c.status === filtre);
  const aValider = items.filter((c) => c.status === "a_valider");

  if (loading) {
    return <main className="p-6 text-gray-600">Chargement...</main>;
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900">Mes candidatures</h1>
        <p className="mt-1 text-sm text-gray-600">
          Relis, modifie, puis valide. Rien n&apos;est envoyé automatiquement.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            className="rounded-lg border border-gray-300 p-2 text-sm text-gray-900"
          >
            <option value="tous">Tous les statuts</option>
            {Object.entries(STATUTS).map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={selection.length === 0}
            onClick={() => appliquer(selection, "validee")}
            className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
          >
            Valider la sélection ({selection.length})
          </button>

          {aValider.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setSelection(
                  selection.length === aValider.length ? [] : aValider.map((c) => c.id)
                )
              }
              className="text-sm text-blue-600 hover:underline"
            >
              {selection.length === aValider.length
                ? "Tout désélectionner"
                : "Tout sélectionner"}
            </button>
          )}
        </div>

        {message && <p className="mt-3 text-sm text-gray-700">{message}</p>}

        {affichees.length === 0 && (
          <p className="mt-6 text-sm text-gray-600">
            Aucune candidature ici. Prépare-en une depuis la page{" "}
            <a href="/offres" className="text-blue-600 underline">
              Offres
            </a>
            .
          </p>
        )}

        <div className="mt-6 space-y-5">
          {affichees.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {c.status === "a_valider" && (
                    <input
                      type="checkbox"
                      checked={selection.includes(c.id)}
                      onChange={() => basculer(c.id)}
                      className="mt-1.5"
                    />
                  )}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {c.offers?.title ?? "Offre"}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {[c.offers?.company, c.offers?.location].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  {STATUTS[c.status] ?? c.status}
                </span>
              </div>

              <label className="mt-4 block text-sm font-medium text-gray-700">
                Lettre de motivation
                <textarea
                  rows={8}
                  value={c.cover_letter ?? ""}
                  onChange={(e) => modifier(c.id, { cover_letter: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-gray-900"
                />
              </label>

              <label className="mt-3 block text-sm font-medium text-gray-700">
                Message de candidature
                <textarea
                  rows={3}
                  value={c.message ?? ""}
                  onChange={(e) => modifier(c.id, { message: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-gray-900"
                />
              </label>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => appliquer([c.id])}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Enregistrer
                </button>

                {c.status === "a_valider" && (
                  <button
                    type="button"
                    onClick={() => appliquer([c.id], "validee")}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Valider
                  </button>
                )}

                {c.status === "validee" && (
                  <>
                    <button
                      type="button"
                      onClick={() => copier(c.cover_letter)}
                      className="rounded-lg border border-blue-600 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
                    >
                      Copier la lettre
                    </button>
                    <button
                      type="button"
                      onClick={() => copier(c.message)}
                      className="rounded-lg border border-blue-600 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
                    >
                      Copier le message
                    </button>
                    {c.offers?.url && (
                      <a
                        href={c.offers.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Ouvrir l&apos;offre
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => appliquer([c.id], "envoyee")}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      J&apos;ai postulé
                    </button>
                  </>
                )}

                {c.status !== "a_valider" && (
                  <button
                    type="button"
                    onClick={() => appliquer([c.id], "a_valider")}
                    className="text-sm text-gray-500 hover:underline"
                  >
                    Remettre à valider
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}