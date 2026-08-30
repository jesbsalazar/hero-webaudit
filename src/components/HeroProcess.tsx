import { motion } from "framer-motion";
import { ArrowDown, ArrowRight, Check, Download, Eye, Flame, Hammer, Search } from "lucide-react";

type Props = { lang: "en" | "es" };

const copy = {
  es: {
    title: "Así funciona HERO OS",
    subtitle: "De una página que pierde clientes a una página que convierte.",
    steps: [
      { n: "01", title: "Analiza", sub: "Leemos tu página a profundidad", bullets: ["Revisamos cada sección", "Analizamos mensaje, oferta y estructura", "Detectamos puntos débiles y oportunidades"], tone: "purple" },
      { n: "02", title: "Audita", sub: "Te damos el roast sin filtros", bullets: ["Auditoría brutalmente honesta", "Fugas de conversión claras", "Prioridades accionables para mejorar"], tone: "orange" },
      { n: "03", title: "Construye", sub: "Rediseñamos tu página para convertir más", bullets: ["Aplicamos principios de CRO", "Reescribimos tu mensaje", "Diseñamos una versión ganadora"], tone: "teal" },
    ],
    download: { n: "04", title: "Descarga", sub: "Tu reporte y tu nueva página, listos para usar", bullets: ["Reporte completo en PDF", "Mockup rediseñado", "Listo para implementar"], cta: "Tu auditoría y mockup están listos." },
    view: "Ver cómo funciona"
  },
  en: {
    title: "How HERO OS works",
    subtitle: "From a page that loses customers to a page built to convert.",
    steps: [
      { n: "01", title: "Analyze", sub: "We read your page in depth", bullets: ["Review every section", "Analyze message, offer and structure", "Find weak points and opportunities"], tone: "purple" },
      { n: "02", title: "Audit", sub: "We give you the unfiltered roast", bullets: ["Brutally honest audit", "Clear conversion leaks", "Actionable priorities to improve"], tone: "orange" },
      { n: "03", title: "Build", sub: "We redesign your page to convert more", bullets: ["Apply CRO principles", "Rewrite your message", "Design a stronger version"], tone: "teal" },
    ],
    download: { n: "04", title: "Download", sub: "Your report and new page, ready to use", bullets: ["Complete PDF report", "Redesigned mockup", "Ready to implement"], cta: "Your audit and mockup are ready." },
    view: "See how it works"
  }
} as const;

const tone = {
  purple: { border: "border-violet-500/60", glow: "shadow-violet-500/10", text: "text-violet-400", bg: "bg-violet-500/10", bar: "bg-violet-500", number: "bg-violet-600" },
  orange: { border: "border-orange-500/60", glow: "shadow-orange-500/10", text: "text-orange-400", bg: "bg-orange-500/10", bar: "bg-orange-500", number: "bg-orange-500" },
  teal: { border: "border-teal-400/60", glow: "shadow-teal-400/10", text: "text-teal-300", bg: "bg-teal-400/10", bar: "bg-teal-400", number: "bg-teal-500" },
} as const;

function Character({ kind }: { kind: "analyze" | "audit" | "build" | "ready" }) {
  const src = kind === "analyze" || kind === "audit" ? "/hero-audit-loading.svg" : kind === "build" ? "/hero-build-loading.svg" : "/hero-ready-loading.svg";
  return <motion.img src={src} alt="" className="mx-auto h-40 w-auto object-contain drop-shadow-2xl md:h-48" animate={{ y: [0, -5, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} />;
}

export function HeroProcess({ lang }: Props) {
  const c = copy[lang];
  return (
    <section className="relative mt-20 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-[#0b1224] via-[#080e1d] to-[#050914] px-4 py-12 shadow-2xl md:px-8 md:py-16">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-72 w-72 rounded-full bg-teal-400/10 blur-3xl" />
      <div className="relative z-10 text-center">
        <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white/60"><SparkIcon /> HERO OS</div>
        <h2 className="text-3xl font-black tracking-tight text-white md:text-5xl">{c.title}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-white/55 md:text-base">{c.subtitle}</p>
        <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-teal-400" />
      </div>

      <div className="relative z-10 mt-10 grid gap-5 lg:grid-cols-3">
        {c.steps.map((s, i) => {
          const t = tone[s.tone];
          return (
            <motion.article key={s.n} whileHover={{ y: -6 }} className={`relative overflow-hidden rounded-3xl border ${t.border} bg-black/20 p-5 shadow-xl ${t.glow} backdrop-blur-sm`}>
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${t.number} text-lg font-black text-white shadow-lg`}>{s.n}</div>
                <div><h3 className={`text-2xl font-black ${t.text}`}>{s.title}</h3><p className="mt-1 text-sm text-white/65">{s.sub}</p></div>
              </div>
              <div className="mt-2"><Character kind={i === 0 ? "analyze" : i === 1 ? "audit" : "build"} /></div>
              <ul className="space-y-3 border-t border-white/10 pt-4 text-sm text-white/75">{s.bullets.map((b) => <li key={b} className="flex gap-2"><Check className={`mt-0.5 h-4 w-4 shrink-0 ${t.text}`} />{b}</li>)}</ul>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/5"><motion.div className={`h-full rounded-full ${t.bar}`} initial={{ width: 0 }} whileInView={{ width: `${55 + i * 15}%` }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.15 }} /></div>
              {i < 2 && <ArrowRight className="absolute -right-4 top-1/2 hidden h-8 w-8 text-white/30 lg:block" />}
            </motion.article>
          );
        })}
      </div>

      <div className="relative z-10 mt-5 overflow-hidden rounded-3xl border border-sky-500/60 bg-gradient-to-r from-sky-500/5 via-white/[0.02] to-teal-500/5 p-5 shadow-xl md:p-7">
        <div className="grid items-center gap-7 md:grid-cols-[1fr_1.2fr_1fr]">
          <div><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500 text-lg font-black text-white">{c.download.n}</div><h3 className="text-2xl font-black text-sky-300">{c.download.title}</h3></div><p className="mt-3 text-sm text-white/65">{c.download.sub}</p><ul className="mt-5 space-y-2 text-sm text-white/70">{c.download.bullets.map((b) => <li key={b} className="flex gap-2"><Check className="h-4 w-4 text-sky-300" />{b}</li>)}</ul></div>
          <div className="relative flex min-h-[210px] items-center justify-center rounded-2xl bg-white/[0.02] p-3"><div className="absolute left-8 top-8 h-28 w-24 -rotate-6 rounded-lg border border-white/15 bg-white/10 p-3 shadow-xl"><div className="text-[10px] font-black text-white/80">HERO OS</div><div className="mt-3 h-2 rounded bg-white/20" /><div className="mt-2 h-2 w-3/4 rounded bg-white/15" /><div className="mt-6 h-12 rounded bg-violet-500/20" /></div><div className="z-10 h-32 w-44 rotate-2 rounded-xl border border-teal-400/40 bg-slate-900 p-3 shadow-2xl"><div className="h-3 w-1/2 rounded bg-teal-400/60" /><div className="mt-3 h-2 rounded bg-white/20" /><div className="mt-2 h-2 w-4/5 rounded bg-white/10" /><div className="mt-5 h-10 rounded bg-teal-400/20" /></div><Character kind="ready" /></div>
          <div className="text-center md:text-left"><p className="text-lg font-black text-white">{c.download.cta} 🎉</p><p className="mt-2 text-sm text-white/55">{lang === "es" ? "Descarga el reporte y llévalo a tu equipo, o agenda una llamada para que lo construyamos por ti." : "Download the report, share it with your team, or book a call and let us build it for you."}</p><div className="mt-5 flex flex-col gap-3 sm:flex-row md:flex-col"><button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-400 px-5 py-3 font-bold text-slate-950 shadow-lg shadow-teal-400/20"><Download className="h-4 w-4" />{lang === "es" ? "Descargar PDF" : "Download PDF"}</button><a href="https://calendly.com/jsbusinesscoach/hero-os-strategy-call" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-400/60 px-5 py-3 font-bold text-orange-300 hover:bg-orange-400/10"><CalendarIcon />{lang === "es" ? "Agendar llamada gratis" : "Book Free Strategy Call"}</a></div></div>
        </div>
      </div>

      <div className="relative z-10 mt-8 text-center text-xs font-medium text-white/45">{lang === "es" ? "Más de 500 emprendedores ya están mejorando sus páginas con HERO OS" : "500+ entrepreneurs are already improving their pages with HERO OS"}</div>
    </section>
  );
}

function SparkIcon() { return <span className="text-fuchsia-400">✦</span>; }
function CalendarIcon() { return <span className="text-sm">▣</span>; }
