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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import logo from "@/assets/hero-os-logo.png";
import { analyzePage, generateMockup, captureLead } from "@/lib/funnel.functions";
import { detectPageLanguage } from "@/lib/language.functions";
import { markBooked } from "@/lib/clickfunnels.functions";
import { ClickFunnelsScheduler, SCHEDULER_URL } from "@/components/ClickFunnelsScheduler";
import { generateAuditPDF } from "@/lib/pdf";
import type { AuditJson } from "@/lib/audit-types";
import { landing } from "@/components/landing/content";
import {
  AuditIntro,
  ProblemSection,
  SystemSection,
  ServicesSection,
  IndustriesSection,
  LocalSection,
  BilingualSection,
  HowItWorksSection,
  AboutSection,
  OutcomesSection,
  FinalCTASection,
} from "@/components/landing/Sections";

function scrollToAudit() {
  if (typeof document === "undefined") return;
  document.getElementById("audit")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const SITE = "https://hero.jsbusinesscoach.com";
const TITLE = "Local Business Marketing Dallas–Fort Worth | Lead Generation & CRO";
const DESC =
  "We help Dallas–Fort Worth home service and local businesses turn traffic into qualified leads, booked appointments and revenue with conversion-focused websites, funnels, AI and automation. Free AI website audit.";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE + "/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: SITE + "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ProfessionalService",
          name: "Jesus Salazar — Local Business Growth & Customer Acquisition",
          url: SITE + "/",
          description: DESC,
          areaServed: [
            "Dallas",
            "Fort Worth",
            "Plano",
            "Frisco",
            "McKinney",
            "Allen",
            "Arlington",
            "Irving",
            "Carrollton",
            "Grapevine",
          ].map((c) => ({ "@type": "City", name: c })),
          address: { "@type": "PostalAddress", addressRegion: "TX", addressCountry: "US" },
          availableLanguage: ["en", "es"],
          knowsAbout: [
            "local business marketing",
            "home services marketing",
            "lead generation",
            "website conversion optimization",
            "marketing automation",
            "paid advertising",
          ],
        }),
      },
    ],
  }),
});

type Phase = "input" | "loading" | "report" | "captured";

function HomePage() {
  const { t, lang, setLang } = useT();
  const L = landing[lang];
  const analyze = useServerFn(analyzePage);
  const detectLanguage = useServerFn(detectPageLanguage);
  const mockup = useServerFn(generateMockup);
  const capture = useServerFn(captureLead);

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
  const mark = useServerFn(markBooked);

  const handleBooked = async () => {
    setBooked(true);
    if (!auditId) return;
    try {
      await mark({ data: { id: auditId } });
    } catch (e) {
      console.error("markBooked failed", e);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    let normalized = url.trim();
    if (normalized && !/^https?:\/\//i.test(normalized)) normalized = "https://" + normalized;
    const parsed = z
      .string()
      .regex(/^https?:\/\/[^\s]+\.[^\s]+$/i)
      .safeParse(normalized);
    if (!parsed.success) {
      toast.error(t("error_invalid_url"));
      return;
    }

    setPhase("loading");
    setStep(0);
    const tick = setInterval(() => setStep((s) => (s < 2 ? s + 1 : s)), 1800);

    try {
      let detectedLanguage = lang;
      try {
        const detected = await detectLanguage({ data: { url: normalized } });
        detectedLanguage = detected.language === "es" ? "es" : "en";
        if (detectedLanguage !== lang) setLang(detectedLanguage);
      } catch (detectionError) {
        console.warn("automatic language detection failed; using current language", detectionError);
      }

      const res = await analyze({ data: { url: normalized, language: detectedLanguage } });
      clearInterval(tick);
      setStep(3);
      setAuditId(res.id);
      setAudit(res.audit);
      // Kick off mockup generation in parallel using the detected page language.
      mockup({ data: { id: res.id, language: detectedLanguage } })
        .then((m) => setMockupHtml(m.html))
        .catch(() => {
          /* mockup is bonus — silent fail */
        });
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
    const parsed = z
      .object({
        first_name: z.string().trim().min(1).max(80),
        last_name: z.string().trim().min(1).max(80),
        email: z.string().trim().email().max(200),
      })
      .safeParse(form);
    if (!parsed.success) {
      toast.error(t("error_generic"));
      return;
    }
    setSubmitting(true);
    try {
      await capture({ data: { id: auditId, ...parsed.data } });
      setPhase("captured");
    } catch {
      toast.error(t("error_generic"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!audit || !auditId) return;
    setDownloading(true);
    try {
      const blob = await generateAuditPDF({
        audit,
        url,
        language: lang,
        mockupHtml: mockupHtml ?? undefined,
        logoUrl: logo,
      });
      const a = document.createElement("a");
      const obj = URL.createObjectURL(blob);
      a.href = obj;
      a.download = `hero-os-audit-${auditId.slice(0, 8)}.pdf`;
      a.rel = "noopener";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(obj), 4000);
    } catch (e) {
      console.error(e);
      toast.error(t("error_generic"));
    } finally {
      setDownloading(false);
    }
  };

  const handleReset = () => {
    setPhase("input");
    setStep(0);
    setUrl("");
    setAuditId(null);
    setAudit(null);
    setMockupHtml(null);
    setForm({ first_name: "", last_name: "", email: "" });
    setBooked(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-10 md:py-16">
        <AnimatePresence mode="wait">
          {phase === "input" && (
            <motion.div key="hero" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <section className="pb-8 pt-4 text-center md:pb-14">
                <img
                  src={logo}
                  alt="HERO OS — local business growth systems"
                  width={120}
                  height={120}
                  className="mx-auto mb-6 h-20 w-20 md:h-24 md:w-24"
                />
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
                  <Sparkles className="h-3 w-3" />
                  {L.hero_eyebrow}
                </div>
                <h1 className="mx-auto max-w-4xl text-balance text-4xl font-bold leading-[1.08] tracking-tight text-foreground md:text-6xl">
                  {L.hero_title}
                </h1>
                <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground md:text-lg">
                  {L.hero_sub}
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button
                    size="lg"
                    onClick={scrollToAudit}
                    className="h-13 w-full bg-primary px-7 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
                  >
                    {L.hero_cta} <ArrowRight className="h-4 w-4" />
                  </Button>
                  <a href="#how-it-works" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-13 w-full border-border/70 px-7 py-3 text-base font-semibold text-foreground hover:bg-panel sm:w-auto"
                    >
                      {L.hero_cta2}
                    </Button>
                  </a>
                </div>
                <p className="mt-5 text-xs text-muted-foreground/80">{L.hero_trust}</p>
              </section>

              <section id="audit" className="scroll-mt-20 py-10 md:py-16">
                <AuditIntro />
                <form
                  onSubmit={handleAnalyze}
                  className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 rounded-2xl border border-border/60 bg-panel p-3 shadow-2xl shadow-primary/10 sm:flex-row"
                >
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={t("url_placeholder")}
                    className="h-12 flex-1 border-0 bg-transparent text-base focus-visible:ring-0"
                    inputMode="url"
                    autoComplete="url"
                    aria-label={t("url_placeholder")}
                  />
                  <Button
                    type="submit"
                    size="lg"
                    className="h-12 bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    {L.audit_cta} <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              </section>

              <ProblemSection />
              <SystemSection />
              <ServicesSection />
              <IndustriesSection />
              <LocalSection />
              <BilingualSection />
              <HowItWorksSection />
              <AboutSection />
              <OutcomesSection />
              <FinalCTASection callUrl={SCHEDULER_URL} />
            </motion.div>
          )}

          {phase === "loading" && (
            <motion.section key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12">
              <h2 className="mb-8 text-center text-xl font-semibold text-foreground">
                {t("analyzing")}
              </h2>
              <LoadingSteps active={step} />
            </motion.section>
          )}

          {(phase === "report" || phase === "captured") && audit && (
            <motion.section key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
              <AuditReport audit={audit} />

              {/* Prominent CTA before the mockup */}
              <div className="overflow-hidden rounded-2xl border-2 border-gold/50 bg-gradient-to-br from-panel-elevated via-panel to-panel-elevated p-6 shadow-2xl shadow-gold/10 md:p-8">
                <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
                  <div>
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold">
                      <Calendar className="h-3 w-3" />
                      {t("hero_eyebrow")}
                    </div>
                    <h3 className="text-xl font-bold leading-tight text-foreground md:text-2xl">
                      {t("cta_pre_mockup_title")}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">
                      {t("cta_pre_mockup_sub")}
                    </p>
                    <p className="mt-3 text-xs font-medium text-gold/90">
                      {t("cta_pre_mockup_reasons")}
                    </p>
                  </div>
                  <a href={SCHEDULER_URL} target="_blank" rel="noopener noreferrer" className="md:justify-self-end">
                    <Button
                      size="lg"
                      className="h-14 w-full bg-gold px-8 text-base font-bold text-gold-foreground shadow-lg shadow-gold/30 hover:bg-gold/90 md:w-auto"
                    >
                      <Calendar className="h-5 w-5" />
                      {t("cta_pre_mockup_btn")}
                    </Button>
                  </a>
                </div>
              </div>

              {/* Mockup preview */}
              <div className="overflow-hidden rounded-2xl border border-gold/30 bg-panel">
                <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
                  <h3 className="text-sm font-semibold text-gold uppercase tracking-wider">
                    {t("mockup_title")}
                  </h3>
                </div>
                <div className="relative h-[520px]">
                  {mockupHtml ? (
                    <iframe
                      title="Redesigned mockup"
                      srcDoc={mockupHtml}
                      className="h-full w-full bg-white"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <p className="text-sm">{t("step_mockup")}</p>
                      </div>
                    </div>
                  )}

                  {phase === "report" && (
                    <div className="pointer-events-none absolute inset-0 backdrop-blur-md" />
                  )}
                  {phase === "report" && (
                    <div className="absolute inset-0 flex items-end bg-gradient-to-t from-background via-background/80 to-transparent p-6">
                      <form
                        onSubmit={handleCapture}
                        className="mx-auto w-full max-w-xl rounded-2xl border border-gold/40 bg-panel-elevated p-6 shadow-2xl"
                      >
                        <div className="mb-4 flex items-center gap-2 text-gold">
                          <Lock className="h-4 w-4" />
                          <h4 className="text-base font-bold">{t("unlock_title")}</h4>
                        </div>
                        <p className="mb-4 text-xs text-muted-foreground">{t("unlock_sub")}</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input
                            placeholder={t("first_name")}
                            value={form.first_name}
                            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                            required
                            maxLength={80}
                          />
                          <Input
                            placeholder={t("last_name")}
                            value={form.last_name}
                            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                            required
                            maxLength={80}
                          />
                        </div>
                        <Input
                          type="email"
                          placeholder={t("email")}
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          required
                          maxLength={200}
                          className="mt-3"
                        />
                        <Button
                          type="submit"
                          disabled={submitting}
                          className="mt-4 w-full bg-gold text-gold-foreground hover:bg-gold/90"
                        >
                          {submitting ? t("sending") : t("unlock_btn")}
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              </div>

              {phase === "captured" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-panel to-panel-elevated p-8 text-center">
                    <h3 className="text-2xl font-bold text-foreground md:text-3xl">{t("thanks_title")}</h3>
                    <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{t("thanks_sub")}</p>
                    <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                      <Button
                        onClick={handleDownload}
                        disabled={downloading}
                        size="lg"
                        variant="outline"
                        className="border-gold/40 text-foreground hover:bg-gold/10"
                      >
                        <Download className="h-4 w-4" />
                        {downloading ? "…" : t("download_pdf")}
                      </Button>
                    </div>
                  </div>

                  {booked ? (
                    <div className="rounded-2xl border border-gold/50 bg-gradient-to-br from-panel-elevated to-panel p-8 text-center">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gold">
                        <Calendar className="h-3 w-3" />
                        {t("booked_title")}
                      </div>
                      <h3 className="text-xl font-bold text-foreground md:text-2xl">{t("booked_title")}</h3>
                      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{t("booked_sub")}</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-gold/40 bg-panel p-6 md:p-8">
                      <div className="mb-4 text-center">
                        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold">
                          <Calendar className="h-3 w-3" />
                          {t("hero_eyebrow")}
                        </div>
                        <h3 className="text-xl font-bold text-foreground md:text-2xl">{t("schedule_block_title")}</h3>
                        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                          {t("schedule_block_sub")}
                        </p>
                      </div>
                      <ClickFunnelsScheduler onBooked={handleBooked} />
                      <div className="mt-4 text-center">
                        <button
                          type="button"
                          onClick={handleBooked}
                          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-gold"
                        >
                          {t("already_booked_help")}
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              <div className="flex justify-center pt-2">
                <Button
                  onClick={handleReset}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t("start_over")}
                </Button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-16 border-t border-border/40 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-bold text-foreground">Jesus Salazar</div>
            <div className="mt-1 text-xs text-muted-foreground">{L.footer_role}</div>
            <div className="mt-1 text-xs text-muted-foreground">{L.footer_place}</div>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <a href="#top" className="hover:text-foreground">{L.footer_home}</a>
            <a href="#audit" className="hover:text-foreground">{L.nav.audit}</a>
            <a href="#services" className="hover:text-foreground">{L.nav.services}</a>
            <a href="#industries" className="hover:text-foreground">{L.nav.industries}</a>
            <a href="#about" className="hover:text-foreground">{L.nav.about}</a>
            <a href="#contact" className="hover:text-foreground">{L.nav.contact}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
