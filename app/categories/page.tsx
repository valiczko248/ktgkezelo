"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Category, CategoryKind } from "@/lib/types";
import { BottomNav } from "@/components/BottomNav";
import { Icon, Plus, X, ChevronLeft, Trash2, ICON_NAMES } from "@/components/Icon";

const COLORS = ["#0A84FF", "#2FD6A8", "#FF6B6B", "#FFB020", "#7C6AE0", "#64748B"];

export default function CategoriesPage() {
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  async function loadAll() {
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    setCategories(data || []);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = categories.filter((c) => c.kind === kind);

  async function remove(c: Category) {
    if (!confirm(`Biztosan törlöd a(z) "${c.name}" kategóriát?`)) return;
    await supabase.from("categories").delete().eq("id", c.id);
    loadAll();
  }

  return (
    <main className="min-h-dvh px-5 pb-32 max-w-lg mx-auto">
      <div className="flex items-center gap-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] mb-5">
        <Link href="/settings" className="w-9 h-9 rounded-full glass flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-display font-semibold text-2xl">Kategóriák</h1>
      </div>

      <div className="flex gap-1 mb-5 p-1 rounded-2xl bg-slate-500/10 max-w-xs">
        <button
          onClick={() => setKind("expense")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium ${
            kind === "expense" ? "bg-white dark:bg-white/10 text-coral shadow-sm" : "text-slate-500"
          }`}
        >
          Kiadás
        </button>
        <button
          onClick={() => setKind("income")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium ${
            kind === "income" ? "bg-white dark:bg-white/10 text-mint-dark shadow-sm" : "text-slate-500"
          }`}
        >
          Bevétel
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {visible.map((c) => (
          <div key={c.id} className="glass rounded-3xl p-4 relative">
            {c.user_id === userId && (
              <button
                onClick={() => remove(c)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-coral/10 text-coral flex items-center justify-center"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => {
                if (c.user_id !== userId) return;
                setEditing(c);
                setFormOpen(true);
              }}
              className="text-left w-full"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center mb-2"
                style={{ backgroundColor: `${c.color}22` }}
              >
                <Icon name={c.icon} className="w-4.5 h-4.5" style={{ color: c.color }} />
              </div>
              <p className="text-sm font-medium">{c.name}</p>
              {c.is_default && <p className="text-[10px] text-slate-400 mt-0.5">Alap kategória</p>}
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        className="w-full py-3 rounded-2xl border border-dashed border-slate-400/40 text-sm text-slate-500 flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4" /> Egyedi kategória létrehozása
      </button>

      {formOpen && (
        <CategoryForm
          kind={kind}
          category={editing}
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

function CategoryForm({
  kind,
  category,
  onClose,
  onSaved,
}: {
  kind: CategoryKind;
  category: Category | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState(category?.name || "");
  const [icon, setIcon] = useState(category?.icon || "tag");
  const [color, setColor] = useState(category?.color || COLORS[0]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    if (category) {
      await supabase.from("categories").update({ name, icon, color }).eq("id", category.id);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await supabase.from("categories").insert({ user_id: user.id, name, kind, icon, color });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md glass-strong rounded-t-4xl sm:rounded-4xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-h-[90dvh] overflow-y-auto animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg">
            {category ? "Kategória szerkesztése" : "Új kategória"}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Név</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pl. Kisállat"
          className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm mb-4"
        />

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Ikon</label>
        <div className="grid grid-cols-7 gap-2 mb-4">
          {ICON_NAMES.map((n) => (
            <button
              key={n}
              onClick={() => setIcon(n)}
              className={`aspect-square rounded-xl flex items-center justify-center border ${
                icon === n ? "border-signal bg-signal/10" : "border-white/60 dark:border-white/10 glass"
              }`}
            >
              <Icon name={n} className="w-4 h-4" />
            </button>
          ))}
        </div>

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
