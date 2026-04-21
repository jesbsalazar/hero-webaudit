import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Target, Users, Type, Megaphone } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { AuditJson } from "@/lib/audit-types";
import { ScoreGauge } from "./ScoreGauge";

function StrengthDot({ ok }: { ok: boolean }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: ok ? "var(--success)" : "var(--danger)" }}
    />
  );
}

export function AuditReport({ audit }: { audit: AuditJson }) {
  const { t } = useT();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Score + summary */}
      <div className="grid gap-6 rounded-2xl border border-gold/20 bg-gradient-to-br from-panel to-panel-elevated p-6 md:grid-cols-[auto_1fr] md:p-8">
        <ScoreGauge score={audit.overall_score} />
        <div className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-gold">{t("audit_ready")}</div>
            <h2 className="mt-1 text-2xl font-bold text-foreground md:text-3xl">
              {audit.page_title || audit.detected_offer}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card icon={<Target className="h-4 w-4" />} label={t("detected_offer")} value={audit.detected_offer} />
            <Card icon={<Users className="h-4 w-4" />} label={t("target_audience")} value={audit.target_audience} />
            <Card
              icon={<Type className="h-4 w-4" />}
              label={t("headline_clarity")}
              value={`${audit.headline_clarity}/100`}
            />
            <Card
              icon={<Megaphone className="h-4 w-4" />}
              label={t("cta_strength")}
              value={t(audit.cta_strength as "weak" | "medium" | "strong")}
            />
          </div>
        </div>
      </div>

      {/* What's working & opportunities */}
      <div className="grid gap-6 md:grid-cols-2">
        <Section
          title={t("whats_working")}
          color="var(--success)"
          icon={<CheckCircle2 className="h-5 w-5" />}
          items={audit.whats_working || []}
        />
        <Section
          title={t("opportunities")}
          color="var(--warning)"
          icon={<AlertTriangle className="h-5 w-5" />}
          items={audit.opportunities || []}
        />
      </div>

      {/* Brunson */}
      <div className="rounded-2xl border border-border/50 bg-panel p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gold">
          {t("brunson_check")}
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: t("big_domino"), b: audit.big_domino },
            { label: t("opportunity_switch"), b: audit.opportunity_switch },
            { label: t("epiphany_bridge"), b: audit.epiphany_bridge },
          ].map(({ label, b }) => (
            <div key={label} className="rounded-xl border border-border/40 bg-background/40 p-4">
              <div className="mb-2 flex items-center gap-2">
                <StrengthDot ok={b.present} />
                <span className="text-sm font-semibold text-foreground">{label}</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{b.note}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function Card({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/30 p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function Section({
  title,
  color,
  icon,
  items,
}: {
  title: string;
  color: string;
  icon: React.ReactNode;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-panel p-6">
      <div className="mb-3 flex items-center gap-2" style={{ color }}>
        {icon}
        <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground/90">
            <span style={{ color }} className="mt-1">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
