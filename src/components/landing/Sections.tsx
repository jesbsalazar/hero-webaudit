import {
  ArrowRight,
  ArrowDown,
  Check,
  Globe,
  Layers,
  LineChart,
  MapPin,
  MessageSquare,
  Megaphone,
  MonitorSmartphone,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { landing } from "./content";

function useL() {
  const { lang } = useT();
  return landing[lang];
}

function scrollToAudit() {
  if (typeof document === "undefined") return;
  document.getElementById("audit")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-20 py-14 md:py-24 ${className}`}>
      {children}
    </section>
  );
}

export function AuditIntro() {
  const l = useL();
  return (
    <div className="mx-auto max-w-3xl text-center">
      <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">{l.audit_title}</h2>
      <p className="mt-4 text-base text-muted-foreground md:text-lg">{l.audit_sub}</p>
      <ul className="mx-auto mt-7 flex max-w-2xl flex-wrap justify-center gap-2">
        {l.audit_checks.map((c) => (
          <li
            key={c}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-panel px-3 py-1.5 text-xs text-muted-foreground"
          >
            <Check className="h-3 w-3 text-primary" />
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProblemSection() {
  const l = useL();
  return (
    <Section>
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">{l.problem_title}</h2>
        <p className="mt-3 text-lg font-semibold text-primary md:text-xl">{l.problem_sub}</p>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-2 md:gap-3">
        {l.problem_flow.map((s, i) => (
          <div key={s} className="flex items-center gap-2 md:gap-3">
            <span className="rounded-xl border border-border/60 bg-panel px-3 py-2 text-xs font-semibold text-foreground md:px-4 md:text-sm">
              {s}
            </span>
            {i < l.problem_flow.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-primary/70" />}
          </div>
        ))}
      </div>

      <ul className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2">
        {l.problem_points.map((p) => (
          <li
            key={p}
            className="flex items-start gap-3 rounded-xl border border-border/50 bg-panel/60 p-4 text-sm text-muted-foreground"
          >
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
            {p}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function SystemSection() {
  const l = useL();
  return (
    <Section>
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">{l.system_title}</h2>
        <p className="mt-3 text-lg font-semibold text-gold md:text-xl">{l.system_sub}</p>
        <p className="mt-4 text-sm text-muted-foreground md:text-base">{l.system_lead}</p>
      </div>

      <div className="mx-auto mt-10 max-w-md">
        {l.system_steps.map((s, i) => (
          <div key={s}>
            <div
              className={`rounded-xl border p-4 text-center text-sm font-semibold ${
                i === l.system_steps.length - 1
                  ? "border-gold/50 bg-gold/10 text-gold"
                  : "border-border/60 bg-panel text-foreground"
              }`}
            >
              {s}
            </div>
            {i < l.system_steps.length - 1 && (
              <div className="flex justify-center py-1.5">
                <ArrowDown className="h-4 w-4 text-primary/70" />
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

const serviceIcons = [
  MonitorSmartphone,
  Layers,
  Zap,
  Megaphone,
  LineChart,
  Globe,
  MessageSquare,
  Workflow,
];

export function ServicesSection() {
  const l = useL();
  return (
    <Section id="services">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">{l.services_title}</h2>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {l.services_stages.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                {s}
              </span>
              {i < l.services_stages.length - 1 && <ArrowRight className="h-3 w-3 text-primary/60" />}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {l.services.map((s, i) => {
          const Icon = serviceIcons[i % serviceIcons.length];
          return (
            <div
              key={s.name}
              className="rounded-2xl border border-border/60 bg-panel p-5 transition hover:border-primary/50"
            >
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="mt-4 text-sm font-bold text-foreground">{s.name}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function IndustriesSection() {
  const l = useL();
  return (
    <Section id="industries">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">{l.who_title}</h2>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border-2 border-gold/50 bg-gradient-to-br from-panel-elevated via-panel to-panel-elevated p-6 md:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold">
            {l.who_primary_label}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {l.who_primary.map((v) => (
              <span
                key={v}
                className="rounded-xl border border-border/60 bg-background/40 px-4 py-2.5 text-sm font-semibold text-foreground"
              >
                {v}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-panel p-6 md:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {l.who_secondary_label}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {l.who_secondary.map((v) => (
              <span key={v} className="rounded-lg border border-border/50 px-3 py-2 text-xs text-muted-foreground">
                {v}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

export function LocalSection() {
  const l = useL();
  return (
    <Section>
      <div className="rounded-3xl border border-border/60 bg-panel p-7 md:p-12">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
              <MapPin className="h-3 w-3" />
              Dallas–Fort Worth
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground md:text-4xl">{l.local_title}</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">{l.local_copy}</p>
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              {l.local_cities.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground"
                >
                  {c}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground/80">{l.local_cities_note}</p>
          </div>
        </div>
      </div>
    </Section>
  );
}

export function BilingualSection() {
  const l = useL();
  return (
    <Section>
      <div className="mx-auto max-w-2xl rounded-2xl border border-border/60 bg-panel/60 p-6 text-center md:p-8">
        <Users className="mx-auto h-5 w-5 text-primary" />
        <h2 className="mt-3 text-xl font-bold text-foreground md:text-2xl">{l.bilingual_title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{l.bilingual_copy}</p>
      </div>
    </Section>
  );
}

export function HowItWorksSection() {
  const l = useL();
  return (
    <Section id="how-it-works">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">{l.how_title}</h2>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {l.how_steps.map((s) => (
          <div key={s.n} className="rounded-2xl border border-border/60 bg-panel p-6">
            <div className="text-3xl font-bold text-primary/50">{s.n}</div>
            <h3 className="mt-3 text-base font-bold uppercase tracking-wide text-foreground">{s.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Button
          onClick={scrollToAudit}
          size="lg"
          className="h-12 bg-primary px-7 font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {l.how_cta} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Section>
  );
}

export function AboutSection() {
  const l = useL();
  return (
    <Section id="about">
      <div className="mx-auto max-w-3xl rounded-3xl border border-border/60 bg-panel p-7 md:p-10">
        <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-4xl">{l.about_title}</h2>
        <div className="mt-5 space-y-4">
          {l.about_body.map((p) => (
            <p key={p.slice(0, 24)} className="text-sm leading-relaxed text-muted-foreground md:text-base">
              {p}
            </p>
          ))}
        </div>
      </div>
    </Section>
  );
}

export function OutcomesSection() {
  const l = useL();
  return (
    <Section>
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">{l.outcomes_title}</h2>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {l.outcomes.map((o) => (
          <div
            key={o.name}
            className="rounded-2xl border border-border/60 bg-gradient-to-br from-panel-elevated to-panel p-7 text-center"
          >
            <h3 className="text-lg font-bold uppercase tracking-wide text-gold md:text-xl">{o.name}</h3>
            <p className="mt-3 text-sm text-muted-foreground">{o.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function FinalCTASection({ callUrl }: { callUrl: string }) {
  const l = useL();
  return (
    <Section id="contact">
      <div className="rounded-3xl border-2 border-gold/50 bg-gradient-to-br from-panel-elevated via-panel to-panel-elevated p-8 text-center md:p-14">
        <h2 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight text-foreground md:text-5xl">
          {l.final_title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground md:text-lg">{l.final_sub}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            onClick={scrollToAudit}
            size="lg"
            className="h-14 w-full bg-gold px-8 text-base font-bold text-gold-foreground hover:bg-gold/90 sm:w-auto"
          >
            {l.final_cta} <ArrowRight className="h-5 w-5" />
          </Button>
          <a href={callUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="outline"
              className="h-14 w-full border-gold/40 px-8 text-base font-semibold text-foreground hover:bg-gold/10 sm:w-auto"
            >
              {l.final_cta2}
            </Button>
          </a>
        </div>
      </div>
    </Section>
  );
}
