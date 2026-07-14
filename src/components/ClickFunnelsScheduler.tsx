import { useEffect, useRef } from "react";

export const SCHEDULER_URL = "https://www.jesusesalazar.com/schedule/funnel-audit";
const SCHEDULER_ORIGIN = "https://www.jesusesalazar.com";

type Props = {
  onBooked: () => void;
  className?: string;
};

export function ClickFunnelsScheduler({ onBooked, className }: Props) {
  const firedRef = useRef(false);

  useEffect(() => {
    function handler(event: MessageEvent) {
      if (event.origin !== SCHEDULER_ORIGIN) return;
      const data = event.data as { id?: string; url?: string } | null;
      if (!data || typeof data !== "object") return;
      if (data.id === "redirectFromIframe") {
        if (firedRef.current) return;
        firedRef.current = true;
        onBooked();
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onBooked]);

  return (
    <iframe
      title="Book your strategy call"
      src={SCHEDULER_URL}
      className={
        className ??
        "w-full rounded-xl border border-border/40 bg-white shadow-lg"
      }
      style={{ minHeight: 900, width: "100%", background: "#ffffff" }}
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
