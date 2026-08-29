import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Download, Calendar, Sparkles, Lock, RotateCcw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";

import { Navbar } from "@/components/Navbar";
import { LoadingSteps } from "@/components/LoadingSteps";
import { AuditReport } from "@/components/AuditReport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import logo from "@/assets/hero-os-logo.png";
import { analyzePage, generateMockup, captureLead } from "@/lib/funnel.functions";
import { markBooked } from "@/lib/clickfunnels.functions";
import { ClickFunnelsScheduler } from "@/components/ClickFunnelsScheduler";
import { generateAuditPDF } from "@/lib/pdf";
import type { AuditJson } from "@/lib/audit-types";

export const Route = createFileRoute("/")({ component: HomePage });
type Phase = "input" | "loading" | "report" | "captured";

function HomePage() {
  const { t, lang } = useT();
  const analyze = useServerFn(analyzePage);
  const mockup = useServerFn(generateMockup);
  const capture = useServerFn(captureLead);
  const mark = useServerFn(markBooked);
  const [phase, setPhase] = useState<Phase>("input");
  const [step, setStep] = useState(0);
  const [url, setUrl] = useState("");
  const [auditId, setAuditId] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditJson | null>(null);
  const [mockupHtml, setMockupHtml] = useState<string | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [booked, setBooked] = useState(false);

  const handleBooked = async () => {
    setBooked(true);
    if (!auditId) return;
    try { await mark({ data: { id: auditId } }); } catch (e) { console.error("markBooked failed", e); }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    let normalized = url.trim();
    if (normalized && !/^https?:\/\//i.test(normalized)) normalized = "https://" + normalized;
    const parsed = z.string().regex(/^https?:\/\/[^\s]+\.[^\s]+$/i).safeParse(normalized);
    if (!parsed.success) { toast.error(t("error_invalid_url")); return; }
    setPhase("loading"); setStep(0);
    const tick = setInterval(() => setStep((s) => (s < 2 ? s + 1 : s)), 1800);
    try {
      const res = await analyze({ data: { url: normalized, language: lang } });
      clearInterval(tick); setStep(3); setAuditId(res.id); setAudit(res.audit);
      mockup({ data: { id: res.id, language: lang } }).then((m) => setMockupHtml(m.html)).catch(() => {});
      setTimeout(() => setPhase("report"), 600);
    } catch (err) {
      clearInterval(tick);
      const code = (err as Error & { message?: string }).message || "";
      if (code.includes("rate_limit")) toast.error(t("error_rate_limit"));
      else if (code.includes("credits")) toast.error(t("error_credits"));
      else if (code.includes("fetch_blocked") || code.includes("fetch_failed")) toast.error(t("error_fetch_blocked"));
      else toast.error(t("error_generic"));
      setPhase("input");
    }
  };

  const handleCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditId) return;
    const parsed = z.object({ first_name: z.string().trim().min(1).max(80), last_name: z.string().trim().min(1).max(80), email: z.string().trim().email().max(200) }).safeParse(form);
    if (!parsed.success) { toast.error(t("error_generic")); return; }
    setSubmitting(true);
    try { await capture({ data: { id: auditId, ...parsed.data } }); setPhase("captured"); }
    catch { toast.error(t("error_generic")); }
    finally { setSubmitting(false); }
  };

  const handleDownload = async () => {
    if (!audit || !auditId) return;
    setDownloading(true);
    try {
      const blob = await generateAuditPDF({ audit, url, language: lang, mockupHtml: mockupHtml ?? undefined, logoUrl: logo });
      const obj = URL.createObjectURL(blob);
      const filename = `hero-os-audit-${auditId.slice(0, 8)}.pdf`;
      // iOS Safari does not reliably honor <a download> for Blob URLs.
      // Open the Blob URL directly on iOS so Safari exposes its native Share/Save UI.
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (isIOS) {
        const opened = window.open(obj, "_blank", "noopener,noreferrer");
        if (!opened) {
          toast.info(isEsDownloadHint(lang));
        }
        setTimeout(() => URL.revokeObjectURL(obj), 60000);
      } else {
        const a = document.createElement("a");
        a.href = obj;
        a.download = filename;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(obj), 4000);
      }
    } catch (e) {
      console.error(e);
      toast.error(t("error_generic"));
    } finally { setDownloading(false); }
  };

  const handleReset = () => {
    setPhase("input"); setStep(0); setUrl(""); setAuditId(null); setAudit(null); setMockupHtml(null);
    setForm({ first_name: "", last_name: "", email: "" }); setBooked(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-16">
        <AnimatePresence mode="wait">
          {phase === "input" && (
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="mx-auto max-w-2xl text-center">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gold"><Sparkles className="h-3 w-3" />HERO OS</div>
              <h1 className="text-4xl font-extrabold tracking-tight text-foreground md:text-6xl">{t("headline")}</h1>
              <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground md:text-lg">{t("subheadline")}</p>
              <form onSubmit={handleAnalyze} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourwebsite.com" className="h-12 flex-1" inputMode="url" autoCapitalize="none" autoCorrect="off" />
                <Button type="submit" size="lg" className="h-12 bg-gold text-gold-foreground hover:bg-gold/90">{t("analyze_btn")}<ArrowRight className="h-4 w-4" /></Button>
              </form>
            </motion.section>
          )}
          {phase === "loading" && <LoadingSteps step={step} />}
          {phase === "report" && audit && (
            <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <AuditReport audit={audit} mockupHtml={mockupHtml} />
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Button onClick={handleReset} variant="ghost" size="sm"><RotateCcw className="h-4 w-4" />{t("new_audit")}</Button>
              </div>
            </motion.section>
          )}
          {phase === "captured" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-panel to-panel-elevated p-8 text-center">
                <h3 className="text-2xl font-bold text-foreground md:text-3xl">{t("thanks_title")}</h3>
                <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{t("thanks_sub")}</p>
                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button onClick={handleDownload} disabled={downloading} size="lg" variant="outline" className="border-gold/40 text-foreground hover:bg-gold/10"><Download className="h-4 w-4" />{downloading ? "…" : t("download_pdf")}</Button>
                </div>
              </div>
              {booked ? (
                <div className="rounded-2xl border border-gold/50 bg-gradient-to-br from-panel-elevated to-panel p-8 text-center"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gold"><Calendar className="h-3 w-3" />{t("booked_title")}</div><h3 className="text-xl font-bold text-foreground md:text-2xl">{t("booked_title")}</h3><p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{t("booked_sub")}</p></div>
              ) : (
                <div className="rounded-2xl border border-gold/40 bg-panel p-6 md:p-8"><div className="mb-4 text-center"><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold"><Calendar className="h-3 w-3" />{t("hero_eyebrow")}</div><h3 className="text-xl font-bold text-foreground md:text-2xl">{t("schedule_block_title")}</h3><p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{t("schedule_block_sub")}</p></div><ClickFunnelsScheduler onBooked={handleBooked} /><div className="mt-4 text-center"><button type="button" onClick={handleBooked} className="text-xs text-muted-foreground underline underline-offset-4 hover:text-gold">{t("already_booked_help")}</button></div></div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function isEsDownloadHint(lang: "en" | "es") {
  return lang === "es" ? "El PDF se abrirá en una nueva pestaña. Usa Compartir → Guardar en Archivos para conservarlo." : "The PDF will open in a new tab. Use Share → Save to Files to keep it.";
}
