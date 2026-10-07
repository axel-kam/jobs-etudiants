"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type FormState = {
  first_name: string;
  last_name: string;
  age: string;
  city: string;
  search_area: string;
  transport: string;
  availability: string;
  education: string;
  experience: string;
  skills: string;
  job_types: string;
  min_salary: string;
  max_distance_km: string;
  other_criteria: string;
};

const emptyForm: FormState = {
  first_name: "",
  last_name: "",
  age: "",
  city: "",
  search_area: "",
  transport: "",
  availability: "",
  education: "",
  experience: "",
  skills: "",
  job_types: "",
  min_salary: "",
  max_distance_km: "",
  other_criteria: "",
};

const fields: {
  key: keyof FormState;
  label: string;
  type?: "text" | "number";
  multiline?: boolean;
  placeholder?: string;
}[] = [
  { key: "first_name", label: "Prénom" },
  { key: "last_name", label: "Nom" },
  { key: "age", label: "Âge", type: "number" },
  { key: "city", label: "Ville" },
  { key: "search_area", label: "Zone de recherche", placeholder: "Ex : Nanterre, Paris, Hauts-de-Seine" },
  { key: "transport", label: "Moyen de transport", placeholder: "Ex : transports en commun, vélo" },
  { key: "availability", label: "Disponibilités", multiline: true, placeholder: "Ex : soirs en semaine, week-ends, vacances" },
  { key: "education", label: "Études / formation", multiline: true },
  { key: "experience", label: "Expériences", multiline: true },
  { key: "skills", label: "Compétences", multiline: true },
  { key: "job_types", label: "Types de jobs recherchés", multiline: true, placeholder: "Ex : animation, restauration, vente" },
  { key: "min_salary", label: "Salaire minimum souhaité (€ / heure)", type: "number" },
  { key: "max_distance_km", label: "Distance maximale (km)", type: "number" },
  { key: "other_criteria", label: "Autres critères importants", multiline: true },
];

export default function ProfilPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }
      setUserId(userData.user.id);

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (data) {
        setForm({
          first_name: data.first_name ?? "",
          last_name: data.last_name ?? "",
          age: data.age?.toString() ?? "",
          city: data.city ?? "",
          search_area: data.search_area ?? "",
          transport: data.transport ?? "",
          availability: data.availability ?? "",
          education: data.education ?? "",
          experience: data.experience ?? "",
          skills: data.skills ?? "",
          job_types: data.job_types ?? "",
          min_salary: data.min_salary?.toString() ?? "",
          max_distance_km: data.max_distance_km?.toString() ?? "",
          other_criteria: data.other_criteria ?? "",
        });
      }
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("profiles").upsert({
      user_id: userId,
      first_name: form.first_name,
      last_name: form.last_name,
      age: form.age ? Number(form.age) : null,
      city: form.city,
      search_area: form.search_area,
      transport: form.transport,
      availability: form.availability,
      education: form.education,
      experience: form.experience,
      skills: form.skills,
      job_types: form.job_types,
      min_salary: form.min_salary ? Number(form.min_salary) : null,
      max_distance_km: form.max_distance_km ? Number(form.max_distance_km) : null,
      other_criteria: form.other_criteria,
      updated_at: new Date().toISOString(),
    });

    setMessage(error ? `Erreur : ${error.message}` : "Profil enregistré !");
    setSaving(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return <main className="p-6 text-gray-600">Chargement...</main>;
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Mon profil</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-blue-600 hover:underline"
          >
            Se déconnecter
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Renseigne ces informations une seule fois. Elles serviront à trouver
          les offres qui te correspondent.
        </p>

        {fields.map((field) => (
          <label key={field.key} className="mt-4 block text-sm text-gray-700">
            {field.label}
            {field.multiline ? (
              <textarea
                rows={3}
                value={form[field.key]}
                placeholder={field.placeholder}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-gray-900"
              />
            ) : (
              <input
                type={field.type ?? "text"}
                min={field.type === "number" ? 0 : undefined}
                value={form[field.key]}
                placeholder={field.placeholder}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-gray-900"
              />
            )}
          </label>
        ))}

        <button
          type="submit"
          disabled={saving}
          className="mt-6 w-full rounded-lg bg-blue-600 p-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer mon profil"}
        </button>

        {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
      </form>
    </main>
  );
}