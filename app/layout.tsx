import "./globals.css";
import AppShell from "./components/app-shell";
import TrackpadNavigation from "./trackpad-navigation";
export const metadata = { title: "Job Search Agent", description: "Local-first job workspace" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><TrackpadNavigation /><AppShell>{children}</AppShell></body></html>;
}
