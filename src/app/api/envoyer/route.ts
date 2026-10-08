import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const LIMITE_PAR_JOUR = 5;
const EMAIL_VALIDE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

type LigneCandidature = {
  id: string;
  cover_letter: string | null;
  message: string | null;
  status: string;
  contact_email: string | null;
  sent_at: string | null;
  offers: { title: string | null; company: string | null } | null;
};

export async function POST(req: Request) {
  // 1. Vérifier que la personne est connectée
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!jwt) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    }
  );

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }
  const userId = userData.user.id;

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return NextResponse.json(
      { error: "L'envoi d'e-mails n'est pas configuré (GMAIL_USER / GMAIL_APP_PASSWORD)." },
      { status: 500 }
    );
  }

  // 2. Lire la demande
  let applicationId: string | undefined;
  try {
    const body = await req.json();
    applicationId = body.applicationId;
  } catch {
    // corps vide ou invalide
  }
  if (!applicationId) {
    return NextResponse.json({ error: "Candidature manquante" }, { status: 400 });
  }

  // 3. Charger la candidature (seule la tienne est visible)
  const { data: ligne } = await supabase
    .from("applications")
    .select("id, cover_letter, message, status, contact_email, sent_at, offers(title, company)")
    .eq("id", applicationId)
    .maybeSingle();

  const app = ligne as unknown as LigneCandidature | null;
  if (!app) {
    return NextResponse.json({ error: "Candidature introuvable" }, { status: 404 });
  }
  if (app.status !== "validee") {
    return NextResponse.json({ error: "Valide d'abord la candidature." }, { status: 400 });
  }
  if (app.sent_at) {
    return NextResponse.json({ error: "Cette candidature a déjà été envoyée." }, { status: 400 });
  }

  const destinataire = (app.contact_email ?? "").trim().toLowerCase();
  if (!EMAIL_VALIDE.test(destinataire)) {
    return NextResponse.json({ error: "Adresse e-mail de contact invalide." }, { status: 400 });
  }
  if (!(app.cover_letter ?? "").trim()) {
    return NextResponse.json({ error: "La lettre de motivation est vide." }, { status: 400 });
  }

  // 4. Garde-fou : plafond sur 24 heures
  const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("sent_at", "is", null)
    .gte("sent_at", depuis);
  if ((count ?? 0) >= LIMITE_PAR_JOUR) {
    return NextResponse.json(
      { error: `Limite atteinte : ${LIMITE_PAR_JOUR} envois par 24 heures.` },
      { status: 429 }
    );
  }

  // 5. Garde-fou : jamais deux envois à la même adresse
  const { data: dejaEnvoye } = await supabase
    .from("applications")
    .select("id")
    .eq("user_id", userId)
    .not("sent_at", "is", null)
    .eq("contact_email", destinataire)
    .limit(1);
  if (dejaEnvoye && dejaEnvoye.length > 0) {
    return NextResponse.json(
      { error: "Tu as déjà envoyé une candidature à cette adresse." },
      { status: 409 }
    );
  }

  // 6. Le CV est obligatoire
  const { data: profil } = await supabase
    .from("profiles")
    .select("first_name, last_name, cv_path")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profil?.cv_path) {
    return NextResponse.json(
      { error: "Ajoute d'abord ton CV sur la page Profil." },
      { status: 400 }
    );
  }
  const { data: fichierCv, error: erreurCv } = await supabase.storage
    .from("cv")
    .download(profil.cv_path);
  if (erreurCv || !fichierCv) {
    return NextResponse.json({ error: "Impossible de lire ton CV." }, { status: 500 });
  }
  const contenuCv = Buffer.from(await fichierCv.arrayBuffer());

  // 7. Réserver l'envoi (évite un double clic)
  const { data: reserve } = await supabase
    .from("applications")
    .update({ sent_at: new Date().toISOString(), contact_email: destinataire })
    .eq("id", app.id)
    .is("sent_at", null)
    .select("id");
  if (!reserve || reserve.length === 0) {
    return NextResponse.json({ error: "Envoi déjà en cours." }, { status: 409 });
  }

  // 8. Envoyer
  const nomComplet = [profil.first_name, profil.last_name].filter(Boolean).join(" ");
  const nomFichier =
    `CV-${nomComplet}`.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") + ".pdf";
  const titre = (app.offers?.title ?? "poste").replace(/[\r\n]+/g, " ");

  try {
    const transporteur = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporteur.sendMail({
      from: nomComplet
        ? `"${nomComplet.replace(/"/g, "")}" <${process.env.GMAIL_USER}>`
        : process.env.GMAIL_USER,
      to: destinataire,
      replyTo: process.env.GMAIL_USER,
      subject: `Candidature – ${titre}`,
      text: `${app.message ?? ""}\n\n${app.cover_letter ?? ""}`.trim(),
      attachments: [
        { filename: nomFichier, content: contenuCv, contentType: "application/pdf" },
      ],
    });
  } catch (e) {
    // L'envoi a échoué : on libère la réservation
    await supabase.from("applications").update({ sent_at: null }).eq("id", app.id);
    const detail = e instanceof Error ? e.message : "Erreur inconnue";
    return NextResponse.json({ error: `Échec de l'envoi : ${detail}` }, { status: 502 });
  }

  // 9. Marquer comme envoyée
  await supabase.from("applications").update({ status: "envoyee" }).eq("id", app.id);

  return NextResponse.json({ ok: true });
}