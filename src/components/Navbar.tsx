import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import logo from "@/assets/hero-os-logo.png";

export function Navbar() {
  const { lang, setLang, t } = useT();
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="HERO OS" width={36} height={36} className="h-9 w-9" />
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-wide text-foreground">HERO OS</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-gold">
              {t("nav_tagline")}
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-panel p-1">
          {(["en", "es"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${
                lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
