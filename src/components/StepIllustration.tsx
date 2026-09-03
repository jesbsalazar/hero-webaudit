import { AnimatePresence, motion } from "framer-motion";
import { useT } from "@/lib/i18n";
import s1en from "@/assets/steps/step1-en.png.asset.json";
import s2en from "@/assets/steps/step2-en.png.asset.json";
import s3en from "@/assets/steps/step3-en.png.asset.json";
import s4en from "@/assets/steps/step4-en.png.asset.json";
import s1es from "@/assets/steps/step1-es.png.asset.json";
import s2es from "@/assets/steps/step2-es.png.asset.json";
import s3es from "@/assets/steps/step3-es.png.asset.json";
import s4es from "@/assets/steps/step4-es.png.asset.json";

const IMAGES = {
  en: [s1en.url, s2en.url, s3en.url, s4en.url],
  es: [s1es.url, s2es.url, s3es.url, s4es.url],
};

const ALTS = {
  en: [
    "Analyze — we read your page in depth",
    "Audit — the no-fluff roast of your funnel",
    "Build — we redesign your page to convert more",
    "Download — your report and new page, ready to use",
  ],
  es: [
    "Analiza — leemos tu página a profundidad",
    "Audita — te damos el roast sin filtros",
    "Construye — rediseñamos tu página para convertir más",
    "Descarga — tu reporte y tu nueva página lista para usar",
  ],
};

export function StepIllustration({ active }: { active: number }) {
  const { lang } = useT();
  const i = Math.min(Math.max(active, 0), 3);
  const src = IMAGES[lang][i];

  return (
    <div className="mx-auto mb-6 w-full max-w-3xl">
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-panel/60">
        <div className="relative aspect-[3/2] w-full">
          <AnimatePresence mode="wait">
            <motion.img
              key={`${lang}-${i}`}
              src={src}
              alt={ALTS[lang][i]}
              loading="eager"
              initial={{ opacity: 0, scale: 1.04, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -12 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </AnimatePresence>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(105deg, transparent 40%, color-mix(in oklab, var(--primary) 18%, transparent) 50%, transparent 60%)",
            }}
            animate={{ x: ["-60%", "60%"] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
          />
        </div>
        <div className="flex justify-center gap-2 py-3">
          {[0, 1, 2, 3].map((n) => (
            <motion.span
              key={n}
              className="h-1.5 rounded-full"
              animate={{
                width: n === i ? 28 : 8,
                opacity: n <= i ? 1 : 0.35,
              }}
              style={{ background: n <= i ? "var(--primary)" : "var(--border)" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
