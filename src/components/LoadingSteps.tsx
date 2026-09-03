import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { StepIllustration } from "./StepIllustration";

export function LoadingSteps({ active }: { active: number }) {
  const { t } = useT();
  const steps = [t("step_fetch"), t("step_analyze"), t("step_audit"), t("step_mockup")] as const;
  return (
    <>
      <StepIllustration active={active} />
      <div className="mx-auto max-w-md space-y-3">

      {steps.map((label, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`flex items-center gap-3 rounded-xl border p-3 ${
              current
                ? "border-primary/60 bg-primary/10"
                : done
                  ? "border-success/30 bg-success/5"
                  : "border-border/40 bg-panel/40"
            }`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background/60">
              {done ? (
                <Check className="h-4 w-4" style={{ color: "var(--success)" }} />
              ) : current ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <span className="text-xs text-muted-foreground">{i + 1}</span>
              )}
            </div>
            <span
              className={`text-sm ${
                current ? "font-semibold text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/70"
              }`}
            >
              {label}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
