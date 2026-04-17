import { useEffect, useState } from "react";
import { PixelSun, PixelMoon } from "./BrutalIcon";

const STORAGE_KEY = "verisol-theme";

const getInitial = (): "light" | "dark" => {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const ThemeToggle = () => {
  const [theme, setTheme] = useState<"light" | "dark">(getInitial);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      className="brutal-box bg-background text-foreground px-3 py-2 flex items-center gap-2 font-bold text-sm uppercase hover:bg-secondary hover:text-secondary-foreground active:translate-x-[2px] active:translate-y-[2px]"
    >
      {theme === "light" ? <PixelMoon size={20} /> : <PixelSun size={20} />}
      <span className="hidden sm:inline">{theme === "light" ? "DARK" : "LIGHT"}</span>
    </button>
  );
};

export default ThemeToggle;
