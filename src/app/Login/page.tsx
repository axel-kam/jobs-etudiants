"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Compte créé ! Tu peux maintenant te connecter.");
        setMode("login");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMessage(error.message);
      } else {
        router.push("/");
      }
    }

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-bold text-gray-900">
          {mode === "login" ? "Connexion" : "Créer un compte"}
        </h1>

        <label className="mt-4 block text-sm text-gray-700">
          E-mail
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-gray-900"
          />
        </label>

        <label className="mt-4 block text-sm text-gray-700">
          Mot de passe (6 caractères minimum)
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-gray-900"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-blue-600 p-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading
            ? "Patiente..."
            : mode === "login"
            ? "Se connecter"
            : "Créer mon compte"}
        </button>

        {message && <p className="mt-4 text-sm text-red-600">{message}</p>}

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setMessage("");
          }}
          className="mt-4 w-full text-sm text-blue-600 hover:underline"
        >
          {mode === "login"
            ? "Pas de compte ? Créer un compte"
            : "Déjà un compte ? Se connecter"}
        </button>
      </form>
    </main>
  );
}