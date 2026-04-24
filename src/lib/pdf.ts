import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";
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

  // Mockup capture — render full page, then split across PDF pages
  if (mockupHtml) {
    try {
      const RENDER_WIDTH = 1200;
      const SCALE = 2; // device pixel ratio for sharp output

      const holder = document.createElement("div");
      holder.style.position = "fixed";
      holder.style.left = "-10000px";
      holder.style.top = "0";
      holder.style.width = RENDER_WIDTH + "px";
      holder.style.background = "#fff";
      holder.style.zIndex = "-1";
      const iframe = document.createElement("iframe");
      iframe.style.width = RENDER_WIDTH + "px";
      iframe.style.height = "900px";
      iframe.style.border = "0";
      iframe.setAttribute("sandbox", "allow-same-origin");
      holder.appendChild(iframe);
      document.body.appendChild(holder);
      iframe.srcdoc = mockupHtml;

      await new Promise<void>((r) => {
        iframe.onload = () => r();
      });

      const doc = iframe.contentDocument!;

      // Wait for fonts + images inside the iframe
      try {
        const anyDoc = doc as unknown as { fonts?: { ready?: Promise<unknown> } };
        if (anyDoc.fonts?.ready) await anyDoc.fonts.ready;
      } catch {
        /* ignore */
      }

      const imgs = Array.from(doc.images);
      await Promise.all(
        imgs.map(
          (img) =>
            new Promise<void>((res) => {
              if (img.complete && img.naturalWidth > 0) return res();
              const done = () => res();
              img.addEventListener("load", done, { once: true });
              img.addEventListener("error", done, { once: true });
              // Safety timeout per image
              setTimeout(done, 4000);
            }),
        ),
      );

      // Force background images / late layout
      await new Promise((r) => setTimeout(r, 800));

      const fullHeight = Math.max(
        doc.body.scrollHeight,
        doc.documentElement.scrollHeight,
        900,
      );
      iframe.style.height = fullHeight + "px";
      await new Promise((r) => setTimeout(r, 400));

      const canvas = await html2canvas(doc.documentElement, {
        backgroundColor: "#ffffff",
        scale: SCALE,
        useCORS: true,
        allowTaint: true,
        logging: false,
        windowWidth: RENDER_WIDTH,
        windowHeight: fullHeight,
        width: RENDER_WIDTH,
        height: fullHeight,
      });
      document.body.removeChild(holder);

      // Title page for the mockup
      pdf.addPage();
      pdf.setTextColor(10, 22, 40);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text(isEs ? "Maqueta rediseñada" : "Redesigned Mockup", 40, 50);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(90, 110, 140);
      pdf.text(
        isEs
          ? "Versión optimizada con el Método HERO basada en tu página."
          : "HERO Method-optimized version based on your page.",
        40,
        68,
      );

      // Layout: full-bleed image, sliced across pages
      const marginX = 24;
      const marginTop = 88;
      const marginBottom = 24;
      const targetW = W - marginX * 2;
      const pxPerPt = canvas.width / targetW; // canvas px per PDF pt
      const firstAvailPt = H - marginTop - marginBottom;
      const followAvailPt = H - 32 - marginBottom;

      let renderedPx = 0;
      let firstSlice = true;
      while (renderedPx < canvas.height) {
        const availablePt = firstSlice ? firstAvailPt : followAvailPt;
        const sliceHeightPx = Math.min(
          canvas.height - renderedPx,
          Math.floor(availablePt * pxPerPt),
        );

        const tmp = document.createElement("canvas");
        tmp.width = canvas.width;
        tmp.height = sliceHeightPx;
        const ctx = tmp.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, tmp.width, tmp.height);
        ctx.drawImage(
          canvas,
          0,
          renderedPx,
          canvas.width,
          sliceHeightPx,
          0,
          0,
          canvas.width,
          sliceHeightPx,
        );
        // PNG keeps text crisp; JPEG would soften thin type
        const sliceData = tmp.toDataURL("image/jpeg", 0.92);
        const drawHeightPt = sliceHeightPx / pxPerPt;
        const yOffset = firstSlice ? marginTop : 32;
        pdf.addImage(
          sliceData,
          "JPEG",
          marginX,
          yOffset,
          targetW,
          drawHeightPt,
          undefined,
          "FAST",
        );

        renderedPx += sliceHeightPx;
        firstSlice = false;
        if (renderedPx < canvas.height) pdf.addPage();
      }
    } catch (e) {
      console.warn("mockup capture failed", e);
    }
  }

  return pdf.output("blob");
}
