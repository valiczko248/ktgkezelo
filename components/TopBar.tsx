"use client";

import { ThemeToggle } from "./ThemeToggle";

export function TopBar({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between mb-5 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div>
        <h1 className="font-display font-semibold text-2xl text-slate-800 dark:text-slate-50 leading-tight">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {right}
        <ThemeToggle />
      </div>
    </header>
  );
}
