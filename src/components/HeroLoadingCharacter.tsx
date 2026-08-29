import { motion } from "framer-motion";
import { Eye, Hammer, Search, Sparkles, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  const lines = isAudit ? auditLines[language] : buildLines[language];
  const safeStep = Math.min(Math.max(step, 0), 3);
  const Icon: LucideIcon = isAudit
    ? safeStep === 2 ? Search : Eye
    : safeStep === 1 ? Wrench : safeStep === 2 ? Hammer : Sparkles;

  return (
    <div className="mx-auto mb-7 flex w-full max-w-md flex-col items-center">
      <div className="relative h-56 w-64">
        <motion.div
          className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/20 bg-gold/5 blur-2xl"
          animate={{ scale: [0.9, 1.08, 0.9], opacity: [0.35, 0.65, 0.35] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="absolute left-1/2 top-7 z-10 -translate-x-1/2"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="relative flex h-28 w-28 flex-col items-center rounded-[32px] border-2 border-gold/50 bg-panel-elevated shadow-xl shadow-black/20">
            <div className="mt-7 flex gap-4">
              <motion.span
                className="h-3.5 w-3.5 rounded-full bg-foreground"
                animate={isAudit ? { scaleY: [1, 0.15, 1] } : { scale: [1, 1.12, 1] }}
                transition={{ duration: 2.8, repeat: Infinity }}
              />
              <motion.span
                className="h-3.5 w-3.5 rounded-full bg-foreground"
                animate={isAudit ? { scaleY: [1, 0.15, 1] } : { scale: [1, 1.12, 1] }}
                transition={{ duration: 2.8, repeat: Infinity, delay: 0.08 }}
              />
            </div>
            <motion.div
              className="mt-5 h-2 w-9 rounded-full bg-gold/70"
              animate={isAudit && safeStep === 2 ? { width: [36, 16, 36] } : { opacity: [0.55, 1, 0.55] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <motion.div
              className="absolute -right-4 top-8 flex h-9 w-9 items-center justify-center rounded-full border border-gold/40 bg-background text-gold"
              animate={{ rotate: [0, 10, -8, 0] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            >
              <Icon className="h-4 w-4" />
            </motion.div>
          </div>

          <motion.div
            className="absolute -left-7 -bottom-3 h-10 w-10 rounded-full border border-gold/30 bg-panel"
            animate={{ rotate: isAudit ? [-12, 12, -12] : [-35, 35, -35] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
          <motion.div
            className="absolute -right-7 -bottom-3 h-10 w-10 rounded-full border border-gold/30 bg-panel"
            animate={{ rotate: isAudit ? [12, -12, 12] : [35, -35, 35] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: 0.1 }}
          />
        </motion.div>

        {isAudit ? (
          <motion.div
            className="absolute bottom-3 left-1/2 h-16 w-48 -translate-x-1/2 rounded-xl border border-border/60 bg-background/80 p-2 shadow-lg backdrop-blur"
            animate={{ y: [2, -2, 2] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          >
            <div className="space-y-1.5">
              <div className="h-2 w-4/5 rounded bg-muted-foreground/25" />
              <div className="h-2 w-full rounded bg-muted-foreground/15" />
              <div className="flex gap-2">
                <div className="h-2 w-1/3 rounded bg-gold/50" />
                <div className="h-2 w-1/2 rounded bg-muted-foreground/15" />
              </div>
            </div>
            <motion.div
              className="absolute -right-1 top-1 h-5 w-5 rounded-full border-2 border-gold/70"
              animate={{ x: [-18, 22, -18], y: [8, 28, 8] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        ) : (
          <motion.div
            className="absolute bottom-1 left-1/2 h-16 w-52 -translate-x-1/2 rounded-xl border border-border/60 bg-background/90 p-2 shadow-lg backdrop-blur"
            animate={{ y: [2, -2, 2] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          >
            <div className="flex h-full items-end gap-2">
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="flex-1 rounded-t bg-gold/30"
                  animate={{ height: ["25%", `${45 + i * 10}%`, "30%"] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </div>
            <motion.div
              className="absolute left-4 top-3 h-1.5 w-16 rounded-full bg-gold/70"
              animate={{ width: [30, 75, 45] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </motion.div>
        )}

        <motion.div
          className="absolute right-1 top-1 rounded-full border border-gold/30 bg-panel px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gold"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        >
          {isAudit ? "ROAST MODE" : "BUILD MODE"}
        </motion.div>
      </div>

      <motion.div
        key={`${mode}-${safeStep}-${language}`}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-full border border-border/60 bg-panel/60 px-4 py-2 text-center text-sm font-medium text-foreground shadow-sm"
      >
        {lines[safeStep]}
      </motion.div>
    </div>
  );
}
