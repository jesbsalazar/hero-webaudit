import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Download, Calendar, Sparkles, Lock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Navbar } from "@/components/Navbar";
import { LoadingSteps } from "@/components/LoadingSteps";
import { AuditReport } from "@/components/AuditReport";
import { HeroProcess } from "@/components/HeroProcess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import logo from "@/assets/hero-os-logo.png";
import { analyzePage } from "@/lib/analyze.functions";
import { captureLead } from "@/lib/funnel.functions";
import { generateFastMockup } from "@/lib/fast-mockup.functions";
import { markBooked } from "@/lib/clickfunnels.functions";
import { ClickFunnelsScheduler, SCHEDULER_URL } from "@/components/ClickFunnelsScheduler";
import { generateAuditPDF } from "@/lib/pdf";
import type { AuditJson } from "@/lib/audit-types";

export const Route = createFileRoute("/")({ component: HomePage });
type Phase = "input" | "loading" | "report" | "captured";

function HomePage() {
  const { t, lang, setLang } = useT();
  const analyze = useServerFn(analyzePage);
  const mockup = useServerFn(generateFastMockup);
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
      const detectedLanguage = res.language === "es" ? "es" : "en";
      if (detectedLanguage !== lang) setLang(detectedLanguage);
      void mockup({ data: { id: res.id, language: detectedLanguage } }).then((m) => setMockupHtml(m.html)).catch((err) => console.warn("background mockup failed", err));
      setTimeout(() => setPhase("report"), 350);
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
    e.preventDefault(); if (!auditId) return;
    const parsed = z.object({ first_name: z.string().trim().min(1).max(80), last_name: z.string().trim().min(1).max(80), email: z.string().trim().email().max(200) }).safeParse(form);
    if (!parsed.success) { toast.error(t("error_generic")); return; }
    setSubmitting(true);
    try { await capture({ data: { id: auditId, ...parsed.data } }); setPhase("captured"); }
    catch { toast.error(t("error_generic")); } finally { setSubmitting(false); }
  };

  const handleDownload = async () => {
    if (!audit || !auditId) return;
    setDownloading(true);
    try {
      const blob = await generateAuditPDF({ audit, url, language: lang, mockupHtml: mockupHtml ?? undefined, logoUrl: logo });
      const obj = URL.createObjectURL(blob); const filename = `hero-os-audit-${auditId.slice(0, 8)}.pdf`;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (isIOS) { const opened = window.open(obj, "_blank", "noopener,noreferrer"); if (!opened) toast.info(isEsDownloadHint(lang)); setTimeout(() => URL.revokeObjectURL(obj), 60000); }
      else { const a = document.createElement("a"); a.href = obj; a.download = filename; a.rel = "noopener"; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(obj), 4000); }
    } catch (e) { console.error(e); toast.error(t("error_generic")); } finally { setDownloading(false); }
  };

  const handleReset = () => {
    setPhase("input"); setStep(0); setUrl(""); setAuditId(null); setAudit(null); setMockupHtml(null); setForm({ first_name: "", last_name: "", email: "" }); setBooked(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-16">
        <AnimatePresence mode="wait">
          {phase === "input" && (
            <motion.section key="hero" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center">
              <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-xs font-medium uppercase tracking-widest text-gold"><Sparkles className="h-3 w-3" />{t("hero_eyebrow")}</div>
              <h1 className="mx-auto max-w-4xl text-balance text-4xl font-black leading-[1.05] tracking-tight text-foreground md:text-6xl">{t("hero_title")}</h1>
              <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground md:text-lg">{t("hero_subtitle")}</p>
              <form onSubmit={handleAnalyze} className="mx-auto mt-8 flex max-w-3xl flex-col gap-3 rounded-2xl border border-gold/20 bg-panel p-3 shadow-2xl shadow-primary/10 sm:flex-row">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("url_placeholder")} className="h-14 flex-1 border-0 bg-transparent text-base focus-visible:ring-0" inputMode="url" autoComplete="url" />
                <Button type="submit" size="lg" className="h-14 bg-primary px-7 font-bold text-primary-foreground hover:bg-primary/90">{t("analyze_btn")} <ArrowRight className="h-4 w-4" /></Button>
              </form>
              <div className="mx-auto mt-4 flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs font-medium text-muted-foreground"><span>✓ IA + CRO</span><span>⚡ {lang === "es" ? "Resultados en minutos" : "Results in minutes"}</span><span>🔒 {lang === "es" ? "100% confidencial" : "100% confidential"}</span></div>
              <HeroProcess lang={lang} />
            </motion.section>
          )}
          {phase === "loading" && <motion.section key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12"><h2 className="mb-8 text-center text-xl font-semibold text-foreground">{t("analyzing")}</h2><LoadingSteps active={step} /></motion.section>}
          {(phase === "report" || phase === "captured") && audit && (
            <motion.section key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
              <AuditReport audit={audit} />
              <div className="overflow-hidden rounded-2xl border-2 border-gold/50 bg-gradient-to-br from-panel-elevated via-panel to-panel-elevated p-6 shadow-2xl shadow-gold/10 md:p-8"><div className="grid items-center gap-6 md:grid-cols-[1fr_auto]"><div><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold"><Calendar className="h-3 w-3" />{t("hero_eyebrow")}</div><h3 className="text-xl font-bold leading-tight text-foreground md:text-2xl">{t("cta_pre_mockup_title")}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">{t("cta_pre_mockup_sub")}</p><p className="mt-3 text-xs font-medium text-gold/90">{t("cta_pre_mockup_reasons")}</p></div><a href={SCHEDULER_URL} target="_blank" rel="noopener noreferrer" className="md:justify-self-end"><Button size="lg" className="h-14 w-full bg-gold px-8 text-base font-bold text-gold-foreground shadow-lg shadow-gold/30 hover:bg-gold/90 md:w-auto"><Calendar className="h-5 w-5" />{t("cta_pre_mockup_btn")}</Button></a></div></div>
              <div className="overflow-hidden rounded-2xl border border-gold/30 bg-panel"><div className="flex items-center justify-between border-b border-border/40 px-5 py-3"><h3 className="text-sm font-semibold uppercase tracking-wider text-gold">{t("mockup_title")}</h3></div><div className="relative h-[520px]">{mockupHtml ? <iframe title="Redesigned mockup" srcDoc={mockupHtml} className="h-full w-full bg-white" sandbox="allow-same-origin" /> : <div className="flex h-full items-center justify-center text-muted-foreground"><div className="text-center"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /><p className="text-sm">{t("step_mockup")}</p></div></div>}{phase === "report" && <div className="pointer-events-none absolute inset-0 backdrop-blur-md" />}{phase === "report" && <div className="absolute inset-0 flex items-end bg-gradient-to-t from-background via-background/80 to-transparent p-6"><form onSubmit={handleCapture} className="mx-auto w-full max-w-xl rounded-2xl border border-gold/40 bg-panel-elevated p-6 shadow-2xl"><div className="mb-4 flex items-center gap-2 text-gold"><Lock className="h-4 w-4" /><h4 className="text-base font-bold">{t("unlock_title")}</h4></div><p className="mb-4 text-xs text-muted-foreground">{t("unlock_sub")}</p><div className="grid gap-3 sm:grid-cols-2"><Input placeholder={t("first_name")} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required maxLength={80} /><Input placeholder={t("last_name")} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: value })} required maxLength={80} /></div><Input type="email" placeholder={t("email")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={200} className="mt-3" /><Button type="submit" disabled={submitting} className="mt-4 w-full bg-gold text-gold-foreground hover:bg-gold/90">{submitting ? t("sending") : t("unlock_btn")}</Button></form></div>}</div></div>
              {phase === "captured" && <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1 }} className="space-y-6"><div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-panel to-panel-elevated p-8 text-center"><h3 className="text-2xl font-bold text-foreground md:text-3xl">{t("thanks_title")}</h3><p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{t("thanks_sub")}</p><div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row"><Button onClick={handleDownload} disabled={downloading} size="lg" variant="outline" className="border-gold/40 text-foreground hover:bg-gold/10"><Download className="h-4 w-4" />{downloading ? "…" : t("download_pdf")}</Button></div></div>{booked ? <div className="rounded-2xl border border-gold/50 bg-gradient-to-br from-panel-elevated to-panel p-8 text-center"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gold"><Calendar className="h-3 w-3" />{t("booked_title")}</div><h3 className="text-xl font-bold text-foreground md:text-2xl">{t("booked_title")}</h3><p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{t("booked_sub")}</p></div> : <div className="rounded-2xl border border-gold/40 bg-panel p-6 md:p-8"><div className="mb-4 text-center"><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold"><Calendar className="h-3 w-3" />{t("hero_eyebrow")}</div><h3 className="text-xl font-bold text-foreground md:text-2xl">{t("schedule_block_title")}</h3><p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{t("schedule_block_sub")}</p></div><ClickFunnelsScheduler onBooked={handleBooked} /><div className="mt-4 text-center"><button type="button" onClick={handleBooked} className="text-xs text-muted-foreground underline underline-offset-4 hover:text-gold">{t("already_booked_help")}</button></div></div>}</motion.div>}
              <div className="flex justify-center pt-2"><Button onClick={handleReset} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground"><RotateCcw className="h-4 w-4" />{t("start_over")}</Button></div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
      <footer className="mt-20 border-t border-border/40 py-6 text-center text-xs text-muted-foreground">{t("footer")}</footer>
    </div>
  );
}

function isEsDownloadHint(lang: "en" | "es") { return lang === "es" ? "El PDF se abrirá en una nueva pestaña. Usa Compartir → Guardar en Archivos para conservarlo." : "The PDF will open in a new tab. Use Share → Save to Files to keep it."; }