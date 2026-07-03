"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const TABS = [
  { href: "/", label: "Áttekintés", icon: "grid" },
  { href: "/transactions", label: "Tételek", icon: "arrow-left-right" },
  { href: "/calendar", label: "Naptár", icon: "calendar" },
  { href: "/stats", label: "Statisztika", icon: "bar-chart" },
  { href: "/settings", label: "Több", icon: "settings" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2">
      <div className="max-w-lg mx-auto glass-strong rounded-4xl px-2 py-2 flex items-center justify-between shadow-glass dark:shadow-glass-dark">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-1.5 flex-1 transition-colors ${
                active ? "text-signal" : "text-slate-400 dark:text-slate-500"
              }`}
            >
              <span
                className={`flex items-center justify-center w-9 h-9 rounded-full transition-all ${
                  active ? "bg-signal/15" : ""
                }`}
              >
                <Icon name={tab.icon} className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
