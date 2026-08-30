import { motion } from "framer-motion";

interface HeroLoadingCharacterProps {
  mode: "audit" | "build";
  step: number;
  language?: "en" | "es";
}

const auditLines = {
  en: ["Reading your page…", "Looking for conversion leaks…", "Okay… this needs a roast.", "I found the opportunities."],
  es: ["Leyendo tu página…", "Buscando fugas de conversión…", "Ok… esto necesita un roast.", "Encontré las oportunidades."],
};

const buildLines = {
  en: ["Planning the new page…", "Fixing the message…", "Building the offer…", "Your new page is ready."],
  es: ["Planeando la nueva página…", "Arreglando el mensaje…", "Construyendo la oferta…", "Tu nueva página está lista."],
};

export function HeroLoadingCharacter({ mode, step, language = "en" }: HeroLoadingCharacterProps) {
  const isAudit = mode === "audit";
  const safeStep = Math.min(Math.max(step, 0), 3);
  const lines = isAudit ? auditLines[language] : buildLines[language];
  const image = isAudit ? "/hero-audit-loading.svg" : "/hero-build-loading.svg";

  return (
    <div className="mx-auto mb-7 w-full max-w-3xl">
      <motion.div
        key={`${mode}-${safeStep}`}
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-[28px] border border-border/50 bg-background/70 shadow-2xl shadow-black/20"
      >
        <img
          src={image}
          alt={isAudit ? "HERO OS audit in progress" : "HERO OS building the redesigned page"}
          className="block h-auto w-full"
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
        <motion.div
          className={`absolute left-1/2 bottom-5 -translate-x-1/2 rounded-full border px-5 py-2 text-sm font-semibold backdrop-blur-md ${isAudit ? "border-violet-400/40 bg-[#0a1024]/85 text-violet-200" : "border-teal-300/40 bg-[#071b25]/85 text-teal-100"}`}
          animate={{ y: [0, -3, 0], opacity: [0.9, 1, 0.9] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          {lines[safeStep]}
        </motion.div>
      </motion.div>
    </div>
  );
}
