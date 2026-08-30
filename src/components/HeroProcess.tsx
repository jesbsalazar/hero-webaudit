import { motion } from "framer-motion";

type Props = { lang: "en" | "es" };

const assets = {
  es: [
    { src: "/hero-process/es-analyze.webp", alt: "HERO OS — Analiza" },
    { src: "/hero-process/es-audit.webp", alt: "HERO OS — Audita" },
    { src: "/hero-process/es-build.webp", alt: "HERO OS — Construye" },
    { src: "/hero-process/es-download.webp", alt: "HERO OS — Descarga" },
  ],
  en: [
    { src: "/hero-process/en-analyze.webp", alt: "HERO OS — Analyze" },
    { src: "/hero-process/en-audit.webp", alt: "HERO OS — Audit" },
    { src: "/hero-process/en-build.webp", alt: "HERO OS — Build" },
    { src: "/hero-process/en-download.webp", alt: "HERO OS — Download" },
  ],
} as const;

export function HeroProcess({ lang }: Props) {
  const visuals = assets[lang];

  return (
    <section
      aria-label={lang === "es" ? "Cómo funciona HERO OS" : "How HERO OS works"}
      className="relative mt-20 overflow-hidden rounded-[2rem] border border-white/10 bg-[#050914] p-3 shadow-2xl md:p-5"
    >
      <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-violet-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-20 h-96 w-96 rounded-full bg-teal-400/10 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl space-y-5">
        {visuals.map((visual, index) => (
          <motion.div
            key={visual.src}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.45, delay: index * 0.05 }}
            className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 shadow-2xl"
          >
            <img
              src={visual.src}
              alt={visual.alt}
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "auto"}
              decoding="async"
              className="block h-auto w-full"
            />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
