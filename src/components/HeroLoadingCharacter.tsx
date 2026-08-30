import { motion } from "framer-motion";

interface HeroLoadingCharacterProps {
  mode: "audit" | "build";
  step: number;
  language?: "en" | "es";
}

const auditLines = {
  en: ["Reading your page…", "Looking for conversion leaks…", "Okay… this needs a roast.", "I found the opportunities."],
  es: ["Leyendo tu página…", "Buscando fugas de conversión…", "Ok… aquí hay algo que roastear.", "Encontré las oportunidades."],
};

const buildLines = {
  en: ["Planning the new page…", "Fixing the message…", "Building the offer…", "Your new page is ready."],
  es: ["Planeando la nueva página…", "Mejorando el mensaje…", "Construyendo la oferta…", "Tu nueva página está lista."],
};

export function HeroLoadingCharacter({ mode, step, language = "en" }: HeroLoadingCharacterProps) {
  const isAudit = mode === "audit";
  const safeStep = Math.min(Math.max(step, 0), 3);
  const lines = isAudit ? auditLines[language] : buildLines[language];

  if (isAudit) {
    return (
      <div className="mx-auto mb-8 w-full max-w-3xl">
        <motion.div
          key={`audit-${safeStep}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative"
        >
          <motion.img
            src="/hero-analyze-loading.jpg"
            alt="HERO OS — Analyze"
            className="mx-auto block h-auto w-full object-contain"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    );
  }

  const image = "/hero-build-loading.svg";
  const eyebrow = language === "es" ? "MODO CONSTRUCCIÓN" : "BUILD MODE";
  const sub = language === "es" ? "Convirtiendo los hallazgos en una página mejor" : "Turning the findings into a better page";

  return (
    <div className="mx-auto mb-8 w-full max-w-3xl">
      <motion.div
        key={`build-${safeStep}`}
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-[32px] border border-gold/25 bg-gradient-to-br from-[#0e1a31] via-[#091225] to-[#07101f] shadow-2xl shadow-black/30"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
        <div className="flex items-center justify-between gap-4 px-5 pt-5 md:px-7">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">HERO OS</div>
            <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
          </div>
          <div className="rounded-full border border-primary/35 bg-primary/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </div>
        </div>

        <div className="relative px-5 pb-5 pt-4 md:px-7 md:pb-7">
          <motion.img
            src={image}
            alt="HERO OS builder"
            className="mx-auto block h-auto max-h-[390px] w-full object-contain"
            animate={{ y: [0, -4, 0], scale: [1, 1.01, 1] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute inset-x-8 bottom-5 h-20 rounded-full bg-black/20 blur-2xl" />
          <motion.div
            className="relative mx-auto -mt-3 w-fit max-w-[90%] rounded-2xl border border-white/10 bg-[#07101f]/90 px-5 py-3 text-center text-sm font-semibold text-foreground shadow-xl backdrop-blur-md md:text-base"
            key={buildLines[language][safeStep]}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {buildLines[language][safeStep]}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
