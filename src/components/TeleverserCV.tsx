"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

const TAILLE_MAX = 5 * 1024 * 1024;

export default function TeleverserCV() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [cvPath, setCvPath] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function charger() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      setUserId(userData.user.id);
      const { data } = await supabase
        .from("profiles")
        .select("cv_path")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      setCvPath(data?.cv_path ?? null);
    }
    charger();
  }, [supabase]);

  async function envoyer(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier || !userId) return;

    if (fichier.type !== "application/pdf") {
      setMessage("Le CV doit être un fichier PDF.");
      return;
    }
    if (fichier.size > TAILLE_MAX) {
      setMessage("Le fichier dépasse 5 Mo.");
      return;
    }

    setLoading(true);
    setMessage("");
    const chemin = `${userId}/cv.pdf`;

    const { error } = await supabase.storage
      .from("cv")
      .upload(chemin, fichier, { upsert: true, contentType: "application/pdf" });
    if (error) {
      setMessage(`Erreur : ${error.message}`);
      setLoading(false);
      return;
    }

    const { error: erreurProfil } = await supabase
      .from("profiles")
      .upsert(
        { user_id: userId, cv_path: chemin, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    if (erreurProfil) {
      setMessage(`Erreur : ${erreurProfil.message}`);
    } else {
      setCvPath(chemin);
      setMessage("CV enregistré.");
    }
    setLoading(false);
  }

  async function ouvrir() {
    if (!cvPath) return;
    const { data, error } = await supabase.storage
      .from("cv")
      .createSignedUrl(cvPath, 60);
    if (error || !data) {
      setMessage("Impossible d'ouvrir le CV.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-medium text-gray-700">Mon CV (PDF, 5 Mo maximum)</p>

      {cvPath && (
        <div className="mt-2 flex items-center gap-3 text-sm text-gray-700">
          <span>✓ Un CV est enregistré.</span>
          <button
            type="button"
            onClick={ouvrir}
            className="text-blue-600 hover:underline"
          >
            Ouvrir
          </button>
        </div>
      )}

      <input
        type="file"
        accept="application/pdf"
        onChange={envoyer}
        disabled={loading}
        className="mt-3 block text-sm text-gray-700"
      />

      {message && <p className="mt-2 text-sm text-gray-700">{message}</p>}
    </div>
  );
}