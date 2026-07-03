"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "./Icon";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      aria-label="Téma váltása"
      className="w-10 h-10 rounded-full glass flex items-center justify-center active:scale-90 transition-transform"
    >
      {isDark ? (
        <Sun className="w-4.5 h-4.5 text-amber" />
      ) : (
        <Moon className="w-4.5 h-4.5 text-signal" />
      )}
    </button>
  );
}
