import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Download, LogOut, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getLeads, updateCallStatus } from "@/server/admin.functions";
import { generateAuditPDF } from "@/lib/pdf";
import logo from "@/assets/hero-os-logo.png";
import type { AuditJson } from "@/lib/audit-types";

export const Route = createFileRoute("/admin/")({
  component: AdminPage,
});

type Lead = {
  id: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  url_submitted: string;
  language: string;
  overall_score: number | null;
  call_status: string;
  audit_json: AuditJson | null;
  mockup_html: string | null;
  brand_colors: unknown;
};

function AdminPage() {
  const navigate = useNavigate();
  const fetchLeads = useServerFn(getLeads);
  const setStatus = useServerFn(updateCallStatus);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Lead | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetchLeads();
      setLeads(r.leads as Lead[]);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load. Check that you are an admin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        navigate({ to: "/admin/login" });
        return;
      }
      load();
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  };

  const changeStatus = async (id: string, status: "pending" | "booked" | "closed") => {
    try {
      await setStatus({ data: { id, status } });
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, call_status: status } : l)));
      toast.success("Updated");
    } catch {
      toast.error("Failed");
    }
  };

  const downloadPdf = async (lead: Lead) => {
    if (!lead.audit_json) return;
    const blob = await generateAuditPDF({
      audit: lead.audit_json,
      url: lead.url_submitted,
      language: (lead.language as "en" | "es") ?? "en",
      mockupHtml: lead.mockup_html ?? undefined,
      logoUrl: logo,
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-${lead.id.slice(0, 8)}.pdf`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-panel">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="HERO OS" width={36} height={36} className="h-9 w-9" />
            <div>
              <div className="text-sm font-bold">HERO OS Admin</div>
              <div className="text-xs text-muted-foreground">{leads.length} leads</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button size="sm" variant="ghost" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="rounded-xl border border-border/50 bg-panel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Lang</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((l) => (
                <TableRow
                  key={l.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(l)}
                >
                  <TableCell className="text-xs">
                    {new Date(l.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {l.first_name || l.last_name ? `${l.first_name ?? ""} ${l.last_name ?? ""}` : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs">{l.email ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="max-w-[260px] truncate text-xs">
                    <a href={l.url_submitted} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">
                      {l.url_submitted}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge variant={(l.overall_score ?? 0) >= 75 ? "default" : "secondary"}>
                      {l.overall_score ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="uppercase text-xs">{l.language}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={l.call_status}
                      onValueChange={(v) => changeStatus(l.id, v as "pending" | "booked" | "closed")}
                    >
                      <SelectTrigger className="h-8 w-[120px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="booked">Booked</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && leads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    No leads yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      <Drawer open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DrawerContent className="max-h-[90vh]">
          {selected && (
            <div className="overflow-y-auto px-6 pb-8">
              <DrawerHeader className="px-0">
                <DrawerTitle>
                  {selected.first_name} {selected.last_name} — Score {selected.overall_score}
                </DrawerTitle>
                <DrawerDescription className="break-all">{selected.url_submitted}</DrawerDescription>
              </DrawerHeader>
              <div className="mb-4 flex gap-2">
                <Button size="sm" onClick={() => downloadPdf(selected)}>
                  <Download className="h-4 w-4" /> PDF
                </Button>
              </div>
              {selected.mockup_html && (
                <div className="mb-6 overflow-hidden rounded-lg border border-border/50">
                  <iframe
                    title="mockup"
                    srcDoc={selected.mockup_html}
                    className="h-[400px] w-full bg-white"
                    sandbox=""
                  />
                </div>
              )}
              <pre className="overflow-auto rounded-lg border border-border/40 bg-background/40 p-4 text-xs">
                {JSON.stringify(selected.audit_json, null, 2)}
              </pre>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
