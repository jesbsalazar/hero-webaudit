import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import logo from "@/assets/hero-os-logo.png";

export function Navbar() {
  const { lang, setLang, t } = useT();
  const process = [t("process_1"), t("process_2"), t("process_3")];

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-2">
        <Link to="/" className="flex shrink-0 items-center gap-3">
          <img src={logo} alt="HERO OS" width={36} height={36} className="h-9 w-9" />
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-wide text-foreground">HERO OS</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-gold">
              {t("nav_tagline")}
            </div>
          </div>
        </Link>

        <div className="hidden items-center gap-2 rounded-full border border-gold/20 bg-panel/70 px-4 py-2 md:flex">
          <span className="mr-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t("process_hint")}</span>
          {process.map((item, index) => (
            <div key={item} className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-[10px] font-bold text-gold">{index + 1}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/80">{item}</span>
              {index < process.length - 1 && <span className="text-gold/40">→</span>}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-panel p-1">
          {["en", "es"].map((l) => (
            <button
              key={l}
              onClick={() => setLang(l as "en" | "es")}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${
                lang === l ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-foreground"
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
