"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Icon, LogOut, ChevronRight } from "@/components/Icon";
import { CURRENCIES } from "@/lib/format";

const LINKS = [
  { href: "/accounts", label: "Fiókok", desc: "Revolut, OTP, készpénz…", icon: "wallet" },
  { href: "/categories", label: "Kategóriák", desc: "Alap és egyedi kategóriák", icon: "grid" },
  { href: "/recurring", label: "Automatikus tételek", desc: "Ismétlődő levonások, bevételek", icon: "repeat" },
  { href: "/budgets", label: "Havi büdzsé", desc: "Kategóriánkénti limitek", icon: "piggy-bank" },
];

export default function SettingsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateCurrency(currency: string) {
    if (!profile) return;
    setProfile({ ...profile, base_currency: currency });
    await supabase.from("profiles").update({ base_currency: currency }).eq("id", profile.id);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main className="min-h-dvh px-5 pb-32 max-w-lg mx-auto">
      <TopBar title="Több" subtitle={email} />

      <div className="glass rounded-4xl p-5 mb-5">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 block">
          Elsődleges pénznem
        </label>
        <div className="flex gap-2 flex-wrap">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              onClick={() => updateCurrency(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                profile?.base_currency === c ? "bg-signal text-white" : "bg-slate-500/10 text-slate-500"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Több fiókod lehet különböző pénznemben is — ezek automatikusan külön csoportban jelennek meg.
        </p>
      </div>

      <div className="glass rounded-4xl divide-y divide-slate-500/10 overflow-hidden mb-5">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-500/5">
            <div className="w-9 h-9 rounded-full bg-signal/10 flex items-center justify-center shrink-0">
              <Icon name={link.icon} className="w-4.5 h-4.5 text-signal" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{link.label}</p>
              <p className="text-xs text-slate-400">{link.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </Link>
        ))}
      </div>

      <button
        onClick={logout}
        className="w-full glass rounded-4xl px-4 py-3.5 flex items-center gap-3 text-coral"
      >
        <div className="w-9 h-9 rounded-full bg-coral/10 flex items-center justify-center shrink-0">
          <LogOut className="w-4.5 h-4.5" />
        </div>
        <span className="text-sm font-medium">Kijelentkezés</span>
      </button>

      <BottomNav />
    </main>
  );
}
