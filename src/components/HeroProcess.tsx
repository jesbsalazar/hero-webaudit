import { motion } from "framer-motion";

type Props = { lang: "en" | "es" };

const assets = {
  es: {
    src: "/hero-process/process-es.webp",
    alt: "HERO OS — Analiza, Audita, Construye y Descarga",
  },
  en: {
    src: "/hero-process/process-en.webp",
    alt: "HERO OS — Analyze, Audit, Build and Download",
  },
} as const;

const steps = [
  { title: "Analyze", position: "0% 0%" },
  { title: "Audit", position: "100% 0%" },
  { title: "Build", position: "0% 100%" },
  { title: "Download", position: "100% 100%" },
] as const;

export function HeroProcess({ lang }: Props) {
  const visual = assets[lang];
  const labels = lang === "es"
    ? ["Analiza", "Audita", "Construye", "Descarga"]
    : ["Analyze", "Audit", "Build", "Download"];

  return (
    <section
      aria-label={lang === "es" ? "Cómo funciona HERO OS" : "How HERO OS works"}
      className="relative mt-20 overflow-hidden rounded-[2rem] border border-white/10 bg-[#050914] p-3 shadow-2xl md:p-5"
    >
      <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-violet-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-20 h-96 w-96 rounded-full bg-teal-400/10 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/45">
            {lang === "es" ? "Así funciona HERO OS" : "How HERO OS works"}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white md:text-4xl">
            {lang === "es" ? "De tu página actual a una página que convierte." : "From your current page to a page built to convert."}
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 shadow-2xl"
            >
              <div
                role="img"
                aria-label={`${index + 1}. ${labels[index]}`}
                className="aspect-[3/2] w-full bg-no-repeat"
                style={{
                  backgroundImage: `url(${visual.src})`,
                  backgroundSize: "200% 200%",
                  backgroundPosition: step.position,
                }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
