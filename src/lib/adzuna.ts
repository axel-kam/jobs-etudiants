export type OffreNormalisee = {
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

export async function rechercherAdzuna(
  motsCles: string,
  lieu: string
): Promise<OffreNormalisee[]> {
  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID!,
    app_key: process.env.ADZUNA_APP_KEY!,
    results_per_page: "15",
    what: motsCles,
    where: lieu,
  });

  const res = await fetch(
    `https://api.adzuna.com/v1/api/jobs/fr/search/1?${params}`
  );
  if (!res.ok) {
    throw new Error(`Adzuna a répondu ${res.status}`);
  }

  const json = await res.json();
  return ((json.results ?? []) as OffreAdzuna[]).map((o) => ({
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
}