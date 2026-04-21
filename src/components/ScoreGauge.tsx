import { motion } from "framer-motion";
import { useT } from "@/lib/i18n";

export function ScoreGauge({ score }: { score: number }) {
  const { t } = useT();
  const clamped = Math.max(0, Math.min(100, score));
  const color =
    clamped >= 75 ? "var(--success)" : clamped >= 50 ? "var(--warning)" : "var(--danger)";
  const label =
    clamped >= 75 ? t("score_label_high") : clamped >= 50 ? t("score_label_mid") : t("score_label_low");

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-52 w-52">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 200 200">
          <circle
            cx="100"
            cy="100"
            r={radius}
            stroke="oklch(1 0 0 / 10%)"
            strokeWidth="14"
            fill="none"
          />
          <motion.circle
            cx="100"
            cy="100"
            r={radius}
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            fill="none"
            initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-6xl font-bold"
            style={{ color }}
          >
            {clamped}
          </motion.div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">/100</div>
        </div>
      </div>
      <div className="mt-3 text-sm font-medium" style={{ color }}>
        {label}
      </div>
    </div>
  );
}
