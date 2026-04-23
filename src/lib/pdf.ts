import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { AuditJson } from "./audit-types";

export async function generateAuditPDF(opts: {
  audit: AuditJson;
  url: string;
  language: "en" | "es";
  mockupHtml?: string;
  logoUrl: string;
}): Promise<Blob> {
  const { audit, url, language, mockupHtml, logoUrl } = opts;
  const isEs = language === "es";
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  // Cover
  pdf.setFillColor(10, 22, 40);
  pdf.rect(0, 0, W, H, "F");

  try {
    const img = await fetch(logoUrl).then((r) => r.blob());
    const dataUrl = await new Promise<string>((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.readAsDataURL(img);
    });
    pdf.addImage(dataUrl, "PNG", W / 2 - 50, 80, 100, 100);
  } catch {
    /* skip */
  }

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(28);
  pdf.text("HERO OS", W / 2, 220, { align: "center" });
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "normal");
  pdf.text(isEs ? "Auditoría de Funnel" : "Funnel Audit Report", W / 2, 245, {
    align: "center",
  });

  pdf.setFontSize(10);
  pdf.setTextColor(180, 200, 230);
  const urlLine = url.length > 70 ? url.slice(0, 67) + "…" : url;
  pdf.text(urlLine, W / 2, 270, { align: "center" });

  // Score circle
  pdf.setFillColor(201, 168, 76);
  pdf.circle(W / 2, 380, 70, "F");
  pdf.setTextColor(10, 22, 40);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(48);
  pdf.text(String(audit.overall_score), W / 2, 395, { align: "center" });
  pdf.setFontSize(11);
  pdf.text("/100", W / 2, 415, { align: "center" });

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(13);
  pdf.text(isEs ? "Puntaje Global del Funnel" : "Overall Funnel Score", W / 2, 480, {
    align: "center",
  });

  // Page 2 - Audit
  pdf.addPage();
  let y = 50;
  pdf.setTextColor(10, 22, 40);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(isEs ? "Resumen" : "Summary", 40, y);
  y += 25;

  const writeKV = (label: string, val: string) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(label, 40, y);
    pdf.setFont("helvetica", "normal");
    const lines = pdf.splitTextToSize(val, W - 80);
    pdf.text(lines, 40, y + 13);
    y += 13 + lines.length * 12 + 8;
  };

  writeKV(isEs ? "Oferta detectada" : "Detected Offer", audit.detected_offer || "-");
  writeKV(isEs ? "Audiencia objetivo" : "Target Audience", audit.target_audience || "-");
  writeKV(
    isEs ? "Claridad del titular" : "Headline Clarity",
    `${audit.headline_clarity}/100`,
  );
  writeKV(
    isEs ? "Fuerza del CTA" : "CTA Strength",
    audit.cta_strength.toUpperCase(),
  );

  const writeList = (title: string, items: string[]) => {
    if (y > H - 100) {
      pdf.addPage();
      y = 50;
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(title, 40, y);
    y += 18;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    for (const it of items) {
      const lines = pdf.splitTextToSize("• " + it, W - 80);
      if (y + lines.length * 12 > H - 50) {
        pdf.addPage();
        y = 50;
      }
      pdf.text(lines, 40, y);
      y += lines.length * 12 + 4;
    }
    y += 10;
  };

  writeList(isEs ? "Lo que está funcionando" : "What's working", audit.whats_working || []);
  writeList(isEs ? "Áreas de oportunidad" : "Opportunities", audit.opportunities || []);

  // Brunson
  if (y > H - 200) {
    pdf.addPage();
    y = 50;
  }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(isEs ? "Chequeo del Método HERO" : "HERO Method Check", 40, y);
  y += 18;
  const brunson: [string, { present: boolean; note: string }][] = [
    ["Big Domino", audit.big_domino],
    ["Opportunity Switch", audit.opportunity_switch],
    ["Epiphany Bridge", audit.epiphany_bridge],
  ];
  for (const [label, b] of brunson) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(`${label}: ${b.present ? (isEs ? "Presente" : "Present") : isEs ? "Falta" : "Missing"}`, 40, y);
    pdf.setFont("helvetica", "normal");
    const lines = pdf.splitTextToSize(b.note || "", W - 80);
    pdf.text(lines, 40, y + 13);
    y += 13 + lines.length * 12 + 10;
    if (y > H - 60) {
      pdf.addPage();
      y = 50;
    }
  }

  // Mockup capture
  if (mockupHtml) {
    try {
      const holder = document.createElement("div");
      holder.style.position = "fixed";
      holder.style.left = "-10000px";
      holder.style.top = "0";
      holder.style.width = "900px";
      holder.style.background = "#fff";
      const iframe = document.createElement("iframe");
      iframe.style.width = "900px";
      iframe.style.height = "1400px";
      iframe.style.border = "0";
      holder.appendChild(iframe);
      document.body.appendChild(holder);
      iframe.srcdoc = mockupHtml;
      await new Promise((r) => {
        iframe.onload = () => setTimeout(r, 600);
      });
      const doc = iframe.contentDocument!;
      const canvas = await html2canvas(doc.body, {
        backgroundColor: "#fff",
        scale: 1.2,
        useCORS: true,
      });
      document.body.removeChild(holder);
      pdf.addPage();
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text(isEs ? "Maqueta rediseñada" : "Redesigned Mockup", 40, 40);
      const imgData = canvas.toDataURL("image/jpeg", 0.85);
      const ratio = canvas.width / canvas.height;
      const targetW = W - 80;
      const targetH = targetW / ratio;
      pdf.addImage(imgData, "JPEG", 40, 60, targetW, Math.min(targetH, H - 100));
    } catch (e) {
      console.warn("mockup capture failed", e);
    }
  }

  return pdf.output("blob");
}
