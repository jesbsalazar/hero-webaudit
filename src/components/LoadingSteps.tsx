import { motion } from "framer-motion";
import { Check, Loader2, Search, WandSparkles, PenLine } from "lucide-react";
import { useT } from "@/lib/i18n";
import { HeroLoadingCharacter } from "@/components/HeroLoadingCharacter";

export function LoadingSteps({ active }: { active: number }) {
  const { t, lang } = useT();
  const steps = [t("step_fetch"), t("step_analyze"), t("step_audit"), t("step_mockup")];
  const icons = [Search, PenLine, WandSparkles, WandSparkles];
  const mode = active >= 3 ? "build" : "audit";
  const characterStep = active >= 3 ? 2 : active;

  return (
    <div className="mx-auto max-w-3xl">
      <HeroLoadingCharacter mode={mode} step={characterStep} language={lang} />

      <div className="mb-5 grid grid-cols-3 gap-2 text-center">
        {[
          { n: "01", label: t("process_1") },
          { n: "02", label: t("process_2") },
          { n: "03", label: t("process_3") },
        ].map((item, i) => (
          <div key={item.n} className={`rounded-xl border px-2 py-2 transition ${i <= 1 || active >= 3 ? "border-gold/30 bg-gold/5" : "border-border/30 bg-panel/30"}`}>
            <div className="text-[9px] font-bold tracking-[0.2em] text-gold/80">{item.n}</div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/80">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-xl space-y-3">
        {steps.map((label, i) => {
          const done = i < active;
          const current = i === active;
          const Icon = icons[i];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`flex items-center gap-3 rounded-2xl border p-3.5 transition-all ${
                current ? "border-primary/60 bg-primary/10 shadow-lg shadow-primary/5" :
                done ? "border-success/30 bg-success/5" : "border-border/40 bg-panel/40"
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/60">
                {done ? <Check className="h-4 w-4" style={{ color: "var(--success)" }} /> : current ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Icon className="h-4 w-4 text-muted-foreground/60" />}
              </div>
              <span className={`text-sm ${current ? "font-semibold text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/70"}`}>{label}</span>
              {current && <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-primary">{lang === "es" ? "En curso" : "Working"}</span>}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
