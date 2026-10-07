export default function Home() {
  const sections = [
    { titre: "Mon profil", texte: "Renseigne ton CV et tes critères une seule fois." },
    { titre: "Offres", texte: "Les offres de jobs étudiants qui te correspondent." },
    { titre: "Candidatures", texte: "Lettres et messages prêts à valider avant envoi." },
    { titre: "Tableau de bord", texte: "Suis tes candidatures, réponses et relances." },
  ];

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900">
          Mes jobs étudiants
        </h1>
        <p className="mt-2 text-gray-600">
          Trouve les offres qui te correspondent et prépare tes candidatures,
          en gardant toujours la main avant l&apos;envoi.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {sections.map((section) => (
            <div
              key={section.titre}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-gray-900">
                {section.titre}
              </h2>
              <p className="mt-1 text-sm text-gray-600">{section.texte}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}