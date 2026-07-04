"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Store } from "@/lib/types";
import { BottomNav } from "@/components/BottomNav";
import { Icon, Plus, X, ChevronLeft, Trash2 } from "@/components/Icon";

const COLORS = ["#0A84FF", "#2FD6A8", "#FF6B6B", "#FFB020", "#7C6AE0", "#64748B"];

export default function StoresPage() {
  const supabase = createClient();
  const [stores, setStores] = useState<Store[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);

  async function loadAll() {
    const { data } = await supabase.from("stores").select("*").eq("is_archived", false).order("created_at");
    setStores(data || []);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function archive(s: Store) {
    if (!confirm(`Biztosan archiválod "${s.name}"-t?`)) return;
    await supabase.from("stores").update({ is_archived: true }).eq("id", s.id);
    loadAll();
  }

  return (
    <main className="min-h-dvh px-5 pb-32 max-w-lg mx-auto">
      <div className="flex items-center gap-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] mb-5">
        <Link href="/settings" className="w-9 h-9 rounded-full glass flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-display font-semibold text-2xl">Boltok</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {stores.map((s) => (
          <div key={s.id} className="glass rounded-3xl p-4 relative">
            <button
              onClick={() => archive(s)}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-coral/10 text-coral flex items-center justify-center"
            >
              <Trash2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => {
                setEditing(s);
                setFormOpen(true);
              }}
              className="text-left w-full"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center mb-2"
                style={{ backgroundColor: `${s.color}22` }}
              >
                <Icon name={s.icon} className="w-4.5 h-4.5" style={{ color: s.color }} />
              </div>
              <p className="text-sm font-medium">{s.name}</p>
            </button>
          </div>
        ))}
        {stores.length === 0 && (
          <p className="col-span-2 text-center text-sm text-slate-400 py-8">Még nincs felvéve bolt.</p>
        )}
      </div>

      <button
        onClick={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        className="w-full py-3 rounded-2xl border border-dashed border-slate-400/40 text-sm text-slate-500 flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4" /> Új bolt hozzáadása
      </button>

      {formOpen && (
        <StoreForm
          store={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            loadAll();
          }}
        />
      )}

      <BottomNav />
    </main>
  );
}

function StoreForm({
  store,
  onClose,
  onSaved,
}: {
  store: Store | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState(store?.name || "");
  const [color, setColor] = useState(store?.color || COLORS[0]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    if (store) {
      await supabase.from("stores").update({ name, color }).eq("id", store.id);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await supabase.from("stores").insert({ user_id: user.id, name, color });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md glass-strong rounded-t-4xl sm:rounded-4xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg">{store ? "Bolt szerkesztése" : "Új bolt"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Név</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pl. Lidl"
          autoFocus
          className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm mb-4"
        />

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Szín</label>
        <div className="flex gap-2 mb-5">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full"
              style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none" }}
            />
          ))}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3 rounded-2xl bg-signal text-white font-medium text-sm active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          Mentés
        </button>
      </div>
    </div>
  );
}
