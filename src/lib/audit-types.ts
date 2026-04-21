export type AuditJson = {
  detected_offer: string;
  target_audience: string;
  overall_score: number; // 0-100
  headline_clarity: number; // 0-100
  cta_strength: "weak" | "medium" | "strong";
  big_domino: { present: boolean; note: string };
  opportunity_switch: { present: boolean; note: string };
  epiphany_bridge: { present: boolean; note: string };
  whats_working: string[];
  opportunities: string[];
  brand_colors: { primary: string; accent: string; background: string };
  page_title: string;
};
