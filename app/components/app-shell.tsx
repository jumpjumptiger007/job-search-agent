"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

const navigation = [
  { label: "Overview", href: "/", section: "Workspace" },
  { label: "Jobs", href: "/jobs", section: "Workspace" },
  { label: "Applications", href: "/applications", section: "Workspace" },
  { label: "Discovery", href: "/discovery", section: "Operations" },
  { label: "History", href: "/history", section: "Operations" },
  { label: "Exports", href: "/exports", section: "Operations" },
] as const;

const themeKey = "job-search-agent-theme";
const themeEvent = "job-search-agent-theme-change";
type ThemePreference = "system" | "light" | "dark";

function getThemeSnapshot(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const saved = window.localStorage.getItem(themeKey);
  return saved === "light" || saved === "dark" ? saved : "system";
}

function subscribeToTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(themeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(themeEvent, callback);
  };
}

function setThemePreference(theme: ThemePreference) {
  if (theme === "system") window.localStorage.removeItem(themeKey);
  else window.localStorage.setItem(themeKey, theme);
  window.dispatchEvent(new Event(themeEvent));
}

function pageTitle(pathname: string) {
  if (pathname.startsWith("/jobs/")) return "Job detail";
  return navigation.find((item) => item.href === pathname)?.label ?? "Job Search Agent";
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => "system");

  useEffect(() => {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.dataset.theme = theme;
    }
  }, [theme]);

  return <div className="app-frame">
    <aside className="app-sidebar" aria-label="Primary navigation">
      <Link className="app-brand" href="/">Job Search Agent</Link>
      {(["Workspace", "Operations"] as const).map((section) => <nav className="nav-section" aria-label={section} key={section}>
        <p>{section}</p>
        {navigation.filter((item) => item.section === section).map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return <Link key={item.href} href={item.href} className={`nav-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>{item.label}</Link>;
        })}
      </nav>)}
    </aside>
    <div className="app-workspace">
      <header className="app-toolbar"><h1>{pageTitle(pathname)}</h1><label className="appearance-control">Appearance<select aria-label="Appearance" value={theme} onChange={(event) => setThemePreference(event.target.value as ThemePreference)}><option value="system">Follow system</option><option value="light">Light</option><option value="dark">Dark</option></select></label></header>
      <div className="workspace-content">{children}</div>
    </div>
  </div>;
}
