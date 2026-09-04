import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import { landing } from "@/components/landing/content";
import { Button } from "@/components/ui/button";
import logo from "@/assets/hero-os-logo.png";

export function Navbar() {
  const { lang, setLang } = useT();
  const L = landing[lang];

  const scrollTo = (id: string) => () => {
    if (typeof document === "undefined") return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header id="top" className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="HERO OS" width={36} height={36} className="h-9 w-9" />
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-wide text-foreground">HERO OS</div>
            <div className="hidden text-[10px] uppercase tracking-[0.18em] text-gold sm:block">
              Dallas–Fort Worth
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-xs font-medium text-muted-foreground lg:flex">
          <button onClick={scrollTo("audit")} className="hover:text-foreground">{L.nav.audit}</button>
          <button onClick={scrollTo("services")} className="hover:text-foreground">{L.nav.services}</button>
          <button onClick={scrollTo("industries")} className="hover:text-foreground">{L.nav.industries}</button>
          <button onClick={scrollTo("about")} className="hover:text-foreground">{L.nav.about}</button>
          <button onClick={scrollTo("contact")} className="hover:text-foreground">{L.nav.contact}</button>
        </nav>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-border/60 bg-panel p-1">
            {(["en", "es"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider transition ${
                  lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <Button
            onClick={scrollTo("audit")}
            size="sm"
            className="hidden bg-gold font-semibold text-gold-foreground hover:bg-gold/90 md:inline-flex"
          >
            {L.nav.audit}
          </Button>
        </div>
      </div>
    </header>
  );
}
