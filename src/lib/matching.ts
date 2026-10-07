export type ProfilMatching = {
  city: string;
  search_area: string;
  job_types: string;
  skills: string;
  experience: string;
  min_salary: number | null;
};

export type OffreMatching = {
  titre: string;
  description: string;
  lieu: string;
  salaire: string;
};

export type ResultatScore = {
  score: number;
  raisons: string[];
};

function normaliser(texte: string) {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function termes(texte: string) {
  return texte
    .split(/[,;\n]/)
    .map((t) => normaliser(t.trim()))
    .filter((t) => t.length >= 3);
}

export function calculerScore(
  profil: ProfilMatching,
  offre: OffreMatching
): ResultatScore {
  const raisons: string[] = [];
  let score = 0;

  const titre = normaliser(offre.titre);
  const description = normaliser(offre.description);
  const lieu = normaliser(offre.lieu);

  // 1. Type de job (45 points)
  const metiers = termes(profil.job_types);
  if (metiers.length === 0) {
    score += 20;
    raisons.push("Aucun type de job renseigné dans ton profil");
  } else if (metiers.some((m) => titre.includes(m))) {
    score += 45;
    raisons.push("✓ Le titre correspond à un job recherché");
  } else if (metiers.some((m) => description.includes(m))) {
    score += 25;
    raisons.push("✓ La description est liée à un job recherché");
  } else {
    raisons.push("✗ Aucun lien avec les jobs recherchés");
  }

  // 2. Lieu (25 points)
  const lieux = termes(`${profil.city},${profil.search_area}`);
  if (lieux.length === 0) {
    score += 10;
    raisons.push("Aucune ville renseignée dans ton profil");
  } else if (lieux.some((l) => lieu.includes(l))) {
    score += 25;
    raisons.push("✓ Lieu dans ta zone de recherche");
  } else {
    raisons.push("✗ Lieu hors de ta zone de recherche");
  }

  // 3. Compétences et expériences (15 points maximum)
  const competences = Array.from(
    new Set([...termes(profil.skills), ...termes(profil.experience)])
  );
  const trouvees = competences.filter(
    (c) => description.includes(c) || titre.includes(c)
  );
  if (trouvees.length > 0) {
    score += Math.min(15, trouvees.length * 5);
    raisons.push(`✓ En lien avec ton profil : ${trouvees.slice(0, 3).join(", ")}`);
  } else {
    raisons.push("✗ Aucune compétence ou expérience repérée dans l'offre");
  }

  // 4. Salaire (15 points)
  const nombre = offre.salaire.match(/\d+/);
  if (!profil.min_salary || !nombre) {
    score += 7;
    raisons.push("Salaire non indiqué (ou aucun minimum fixé)");
  } else {
    const horaire = Number(nombre[0]) / 1607; // 1607 h = année de travail à temps plein
    if (horaire >= profil.min_salary) {
      score += 15;
      raisons.push(`✓ Salaire d'environ ${horaire.toFixed(1)} €/h, compatible`);
    } else {
      raisons.push(`✗ Salaire d'environ ${horaire.toFixed(1)} €/h, sous ton minimum`);
    }
  }

  return { score: Math.min(100, score), raisons };
}