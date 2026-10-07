type ProfilCandidature = {
  first_name?: string | null;
  last_name?: string | null;
  education?: string | null;
  experience?: string | null;
  skills?: string | null;
  availability?: string | null;
};

type OffreCandidature = {
  titre: string;
  entreprise: string;
};

function nettoyer(texte?: string | null) {
  return (texte ?? "").replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
}

export function genererCandidature(
  profil: ProfilCandidature,
  offre: OffreCandidature
): { lettre: string; message: string } {
  const prenom = nettoyer(profil.first_name);
  const nom = nettoyer(profil.last_name);
  const signature = [prenom, nom].filter(Boolean).join(" ");

  const entreprise =
    offre.entreprise && offre.entreprise !== "Non précisée"
      ? ` au sein de ${offre.entreprise}`
      : "";

  const paragraphes: string[] = [
    "Madame, Monsieur,",
    `Je me permets de vous adresser ma candidature pour le poste de ${offre.titre}${entreprise}.`,
  ];

  const infos: string[] = [];
  if (nettoyer(profil.education)) {
    infos.push(`Ma formation : ${nettoyer(profil.education)}.`);
  }
  if (nettoyer(profil.experience)) {
    infos.push(`Mon parcours : ${nettoyer(profil.experience)}.`);
  }
  if (nettoyer(profil.skills)) {
    infos.push(`Mes compétences : ${nettoyer(profil.skills)}.`);
  }
  if (nettoyer(profil.availability)) {
    infos.push(`Mes disponibilités : ${nettoyer(profil.availability)}.`);
  }
  if (infos.length > 0) paragraphes.push(infos.join("\n"));

  paragraphes.push(
    "Je reste à votre disposition pour un entretien et vous remercie de l'attention portée à ma candidature."
  );
  paragraphes.push(`Cordialement,\n${signature}`.trim());

  const lettre = paragraphes.join("\n\n");

  const message =
    `Bonjour, je souhaite candidater au poste de ${offre.titre}${entreprise}. ` +
    `Vous trouverez ma lettre de motivation ci-dessous. ` +
    `Je reste disponible pour échanger. Cordialement, ${signature}`.trim();

  return { lettre, message };
}