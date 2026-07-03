"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Wallet, Mail, Lock, Loader2 } from "lucide-react";

export default function LoginPage() {
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({ type: "error", text: "Hibás e-mail cím vagy jelszó." });
      } else {
        window.location.href = "/";
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({
          type: "info",
          text: "Sikeres regisztráció! Nézd meg az e-mail fiókodat a megerősítéshez.",
        });
      }
    }
    setLoading(false);
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-3xl glass-strong flex items-center justify-center mb-4 shadow-glow-signal">
            <Wallet className="w-8 h-8 text-signal" strokeWidth={2} />
          </div>
          <h1 className="font-display font-semibold text-2xl text-slate-800 dark:text-slate-50">
            Költségkövető
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            A pénzügyeid, csak a te szemeidnek
          </p>
        </div>

        <div className="glass rounded-4xl p-6">
          <div className="flex gap-1 mb-6 p-1 rounded-2xl bg-slate-500/10">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                mode === "login"
                  ? "bg-white dark:bg-white/10 text-signal shadow-sm"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              Bejelentkezés
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                mode === "register"
                  ? "bg-white dark:bg-white/10 text-signal shadow-sm"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              Regisztráció
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                placeholder="E-mail cím"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none focus:ring-2 focus:ring-signal text-sm placeholder:text-slate-400"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Jelszó"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none focus:ring-2 focus:ring-signal text-sm placeholder:text-slate-400"
              />
            </div>

            {message && (
              <p
                className={`text-xs px-1 ${
                  message.type === "error" ? "text-coral" : "text-mint-dark"
                }`}
              >
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-signal text-white font-medium text-sm flex items-center justify-center gap-2 shadow-glow-signal active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" ? "Bejelentkezés" : "Fiók létrehozása"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Az adataidat csak te érheted el — jelszóval védett, titkosított kapcsolat.
        </p>
      </div>
    </main>
  );
}
