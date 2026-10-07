"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { genererCandidature } from "@/lib/candidature";

type OffreMinimale = {
  id: string;
  titre: string;
  entreprise: string;
};

export default function PreparerCandidature({ offre }: { offre: OffreMinimale }) {
  const supabase = useMemo(() => createClient(), []);
  const [ouvert, setOuvert] = useState(false);
  const [lettre, setLettre] = useState("");
  const [message, setMessage] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function trouverOffreDb(userId: string) {
    const { data } = await supabase
      .from("offers")
      .select("id")
      .eq("user_id", userId)
      .eq("source", "adzuna")
      .eq("external_id", offre.id)
      .maybeSingle();
    return data?.id as string | undefined;
  }

  async function preparer() {
    setLoading(true);
    setInfo("");

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setInfo("Connecte-toi d'abord.");
      setLoading(false);
      return;
    }

    // Reprendre un brouillon déjà enregistré, s'il existe
    const offreDbId = await trouverOffreDb(user.id);
    if (offreDbId) {
      const { data: existante } = await supabase
        .from("applications")
        .select("cover_letter, message")
        .eq("user_id", user.id)
        .eq("offer_id", offreDbId)
        .maybeSingle();
      if (existante) {
        setLettre(existante.cover_letter ?? "");
        setMessage(existante.message ?? "");
        setOuvert(true);
        setInfo("Brouillon déjà enregistré, repris tel quel.");
        setLoading(false);
        return;
      }
    }

    // Sinon, générer à partir du profil
    const { data: profil } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profil) {
      setInfo("Remplis d'abord ton profil sur la page /profil.");
      setLoading(false);
      return;
    }

    const resultat = genererCandidature(profil, offre);
    setLettre(resultat.lettre);
    setMessage(resultat.message);
    setOuvert(true);
    setLoading(false);
  }

  async function enregistrer() {
    setLoading(true);
    setInfo("");

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setInfo("Connecte-toi d'abord.");
      setLoading(false);
      return;
    }

    const offreDbId = await trouverOffreDb(user.id);
    if (!offreDbId) {
      setInfo("Offre introuvable dans la base : relance la recherche.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("applications").upsert(
      {
        user_id: user.id,
        offer_id: offreDbId,
        cover_letter: lettre,
        message,
        status: "a_valider",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,offer_id" }
    );

    setInfo(error ? `Erreur : ${error.message}` : "Brouillon enregistré (à valider).");
    setLoading(false);
  }

  if (!ouvert) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={preparer}
          disabled={loading}
          className="rounded-lg border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
        >
          {loading ? "Préparation..." : "Préparer la candidature"}
        </button>
        {info && <p className="mt-2 text-sm text-red-600">{info}</p>}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <label className="block text-sm font-medium text-gray-700">
        Lettre de motivation
        <textarea
          rows={10}
          value={lettre}
          onChange={(e) => setLettre(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-gray-900"
        />
      </label>

      <label className="mt-3 block text-sm font-medium text-gray-700">
        Message de candidature
        <textarea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-gray-900"
        />
      </label>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={enregistrer}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Enregistrement..." : "Enregistrer le brouillon"}
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="text-sm text-gray-600 hover:underline"
        >
          Fermer
        </button>
      </div>
      {info && <p className="mt-2 text-sm text-gray-700">{info}</p>}
    </div>
  );
}