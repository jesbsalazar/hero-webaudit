import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "es";

const dict = {
  en: {
    nav_tagline: "Funnel Analyzer",
    hero_eyebrow: "Free AI-powered audit",
    hero_title: "Is your sales page costing you customers?",
    hero_subtitle:
      "Paste your URL. In 60 seconds, our AI grades your funnel with the HERO Method — and shows you a redesigned mockup.",
    url_placeholder: "https://yourbusiness.com",
    analyze_btn: "Analyze my page",
    analyzing: "Analyzing…",
    step_fetch: "Fetching your page",
    step_analyze: "Analyzing copy & offer",
    step_audit: "Building your audit",
    step_mockup: "Designing the mockup",
    audit_ready: "Your audit is ready",
    overall_score: "Overall Funnel Score",
    detected_offer: "Detected Offer",
    target_audience: "Target Audience",
    whats_working: "What's working",
    opportunities: "Opportunities",
    brunson_check: "HERO Method Check",
    big_domino: "Big Domino Statement",
    opportunity_switch: "Opportunity Switch",
    epiphany_bridge: "Epiphany Bridge",
    headline_clarity: "Headline Clarity",
    cta_strength: "CTA Strength",
    mockup_title: "AI-redesigned version of your page",
    unlock_title: "Unlock the full mockup + PDF report",
    unlock_sub: "Free. No credit card. Just your name and email.",
    first_name: "First name",
    last_name: "Last name",
    email: "Email",
    unlock_btn: "Unlock my mockup",
    sending: "Sending…",
    thanks_title: "You're all set",
    thanks_sub: "Download your full PDF report or book your free strategy call below.",
    download_pdf: "Download PDF report",
    book_call: "Book my free call",
    footer: "HERO OS · Built for high-performing offers",
    error_invalid_url: "Please enter a valid URL (https://...)",
    error_generic: "Something went wrong. Please try again.",
    error_rate_limit: "Too many requests right now. Please wait a moment and retry.",
    error_credits: "AI credits exhausted. Please contact support.",
    yes: "Yes",
    no: "No",
    weak: "Weak",
    medium: "Medium",
    strong: "Strong",
    present: "Present",
    missing: "Missing",
    score_label_low: "Needs urgent work",
    score_label_mid: "Solid but leaking",
    score_label_high: "Strong funnel",
    cta_pre_mockup_title: "Want a custom redesign of your page — done for you?",
    cta_pre_mockup_sub: "Book a free 30-minute strategy call. We'll walk through your audit, show you exactly what to fix, and decide together if working with us makes sense. No pitch, no pressure.",
    cta_pre_mockup_btn: "Book my free strategy call",
    cta_pre_mockup_reasons: "Personalized walkthrough · Tailored fix-list · No commitment",
    start_over: "Analyze another page",
  },
  es: {
    nav_tagline: "Analizador de Funnels",
    hero_eyebrow: "Auditoría gratis con IA",
    hero_title: "¿Tu página de ventas te está costando clientes?",
    hero_subtitle:
      "Pega tu URL. En 60 segundos, nuestra IA califica tu funnel con el Método HERO — y te muestra una maqueta rediseñada.",
    url_placeholder: "https://tunegocio.com",
    analyze_btn: "Analizar mi página",
    analyzing: "Analizando…",
    step_fetch: "Obteniendo tu página",
    step_analyze: "Analizando copy y oferta",
    step_audit: "Construyendo tu auditoría",
    step_mockup: "Diseñando la maqueta",
    audit_ready: "Tu auditoría está lista",
    overall_score: "Puntaje Global del Funnel",
    detected_offer: "Oferta Detectada",
    target_audience: "Audiencia Objetivo",
    whats_working: "Lo que está funcionando",
    opportunities: "Áreas de oportunidad",
    brunson_check: "Chequeo del Método HERO",
    big_domino: "Big Domino Statement",
    opportunity_switch: "Opportunity Switch",
    epiphany_bridge: "Epiphany Bridge",
    headline_clarity: "Claridad del Titular",
    cta_strength: "Fuerza del CTA",
    mockup_title: "Versión rediseñada por IA de tu página",
    unlock_title: "Desbloquea la maqueta completa + reporte PDF",
    unlock_sub: "Gratis. Sin tarjeta. Solo tu nombre y correo.",
    first_name: "Nombre",
    last_name: "Apellido",
    email: "Correo",
    unlock_btn: "Desbloquear mi maqueta",
    sending: "Enviando…",
    thanks_title: "¡Listo!",
    thanks_sub: "Descarga tu reporte PDF o reserva tu llamada estratégica gratis abajo.",
    download_pdf: "Descargar reporte PDF",
    book_call: "Reservar mi llamada gratis",
    footer: "HERO OS · Hecho para ofertas de alto rendimiento",
    error_invalid_url: "Por favor ingresa una URL válida (https://...)",
    error_generic: "Algo salió mal. Inténtalo de nuevo.",
    error_rate_limit: "Demasiadas solicitudes. Espera un momento e intenta de nuevo.",
    error_credits: "Sin créditos de IA. Contacta a soporte.",
    yes: "Sí",
    no: "No",
    weak: "Débil",
    medium: "Medio",
    strong: "Fuerte",
    present: "Presente",
    missing: "Falta",
    score_label_low: "Requiere trabajo urgente",
    score_label_mid: "Sólido pero con fugas",
    score_label_high: "Funnel fuerte",
    cta_pre_mockup_title: "¿Quieres un rediseño personalizado de tu página, hecho por nosotros?",
    cta_pre_mockup_sub: "Reserva una llamada estratégica gratuita de 30 minutos. Revisamos juntos tu auditoría, te mostramos exactamente qué corregir y vemos si tiene sentido trabajar juntos. Sin venta dura, sin compromiso.",
    cta_pre_mockup_btn: "Reservar mi llamada gratis",
    cta_pre_mockup_reasons: "Revisión personalizada · Plan de acción a tu medida · Sin compromiso",
    start_over: "Analizar otra página",
  },
} as const;

export type TKey = keyof typeof dict.en;

const I18nCtx = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TKey) => string;
}>({ lang: "en", setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("hero_lang");
    if (stored === "en" || stored === "es") setLangState(stored);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem("hero_lang", l);
  };

  const t = (k: TKey) => dict[lang][k] ?? k;

  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export const useT = () => useContext(I18nCtx);
