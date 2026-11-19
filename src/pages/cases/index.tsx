import { ChevronRight, FileText, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LoadingPanel } from "@/components/common/loading-panel";
import { Pill } from "@/components/common/status-pill";
import { CaseForm } from "@/components/forms/case-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/hooks/use-workspace";
import { CASE_STATUS_OPTIONS, ROUND_STAGES } from "@/lib/constants";
import { formatShortDate } from "@/lib/format";
import { EMPTY_WORKSPACE } from "@/lib/workspace";

const MEMO_STATUS_LABEL = {
  draft: "Draft",
  needs_review: "Needs Review",
  approved: "Approved",
} as const;

const Deals = () => {
  const { data, isLoading } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const requestedStage = searchParams.get("stage");
  const requestedStatus = searchParams.get("status");

  const latestMemoByDeal = useMemo(() => {
    const map = new Map<string, (typeof workspace.dealMemos)[number]>();
    for (const memo of [...workspace.dealMemos].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())) {
      if (!map.has(memo.dealId)) map.set(memo.dealId, memo);
    }
    return map;
  }, [workspace]);

  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return workspace.cases
      .filter((item) => {
        if (requestedStage) {
          if (requestedStage === "Unknown") {
            if (item.roundStage.trim() && (ROUND_STAGES as readonly string[]).includes(item.roundStage.trim())) return false;
          } else if (item.roundStage.trim() !== requestedStage) return false;
        }
        if (requestedStatus && CASE_STATUS_OPTIONS.some((option) => option.value === requestedStatus) && item.status !== requestedStatus) return false;
        return !search || `${item.companyName} ${item.sector} ${item.geography}`.toLowerCase().includes(search);
      })
      .map((item) => ({
        ...item,
        documentCount: workspace.caseDocuments.filter((document) => document.dealId === item.id).length,
        memo: latestMemoByDeal.get(item.id) ?? null,
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [workspace, latestMemoByDeal, query, requestedStage, requestedStatus]);

  const filtered = Boolean(requestedStage || requestedStatus);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-7">
      <PageHeader
        title="Deals"
        description="Every company folder in one searchable list."
        actions={
          <Button variant="outline" className="h-10 gap-2 text-[16px]" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />New deal
          </Button>
        }
      />

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search deals"
          aria-label="Search deals"
          className="h-11 bg-card pl-10 text-[16px]"
        />
      </div>

      {filtered ? (
        <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted-foreground">
          <span>Showing an older saved filter.</span>
          <Link to="/cases" className="font-medium text-brand-strong hover:underline">Clear filter</Link>
        </div>
      ) : null}

      {isLoading ? (
        <LoadingPanel rows={4} />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <p className="text-[18px] font-medium">{workspace.cases.length === 0 ? "No deals yet" : "No deals match"}</p>
          <p className="mt-1 text-[16px] text-muted-foreground">
            {workspace.cases.length === 0 ? "Import a file or create a deal folder." : "Try another search."}
          </p>
          {workspace.cases.length === 0 ? (
            <div className="mt-4 flex justify-center gap-2">
              <Button onClick={() => setFormOpen(true)} className="text-[16px]">New deal</Button>
              <Button asChild variant="outline" className="text-[16px]"><Link to="/imports">Import Files</Link></Button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-card md:block">
            <div className="grid grid-cols-[minmax(0,1fr)_150px_110px_150px_28px] gap-4 border-b border-border bg-secondary/40 px-5 py-3 text-[14px] font-semibold text-muted-foreground">
              <span>Company</span><span>Last updated</span><span>Documents</span><span>Memo status</span><span />
            </div>
            <ul className="divide-y divide-border">
              {rows.map((item) => (
                <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_150px_110px_150px_28px] items-center gap-4 px-5 py-4">
                  <Link to={`/cases/${item.id}`} className="truncate text-[17px] font-medium hover:text-brand-strong">{item.companyName}</Link>
                  <span className="text-[16px] text-muted-foreground">{formatShortDate(item.updatedAt)}</span>
                  <Link to={`/cases/${item.id}#documents`} className="inline-flex items-center gap-1.5 text-[16px] text-muted-foreground hover:text-brand-strong">
                    <FileText className="h-4 w-4" aria-hidden="true" />{item.documentCount}
                  </Link>
                  <Link to={`/cases/${item.id}#memo`} className="inline-flex">
                    <Pill tone={item.memo?.status === "approved" ? "success" : item.memo?.status === "needs_review" ? "warning" : "neutral"} className="text-[14px]">
                      {item.memo ? MEMO_STATUS_LABEL[item.memo.status] : "No memo"}
                    </Pill>
                  </Link>
                  <Link to={`/cases/${item.id}`} aria-label={`Open ${item.companyName}`} className="text-muted-foreground hover:text-brand-strong">
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-card md:hidden">
            {rows.map((item) => (
              <li key={item.id} className="p-5">
                <Link to={`/cases/${item.id}`} className="text-[20px] font-semibold tracking-tight hover:text-brand-strong">{item.companyName}</Link>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-[14px]">
                  <div><dt className="text-muted-foreground">Last updated</dt><dd className="mt-0.5 text-[16px]">{formatShortDate(item.updatedAt)}</dd></div>
                  <div><dt className="text-muted-foreground">Documents</dt><dd className="mt-0.5 text-[16px]">{item.documentCount}</dd></div>
                  <div><dt className="text-muted-foreground">Memo status</dt><dd className="mt-1"><Pill tone={item.memo?.status === "approved" ? "success" : item.memo?.status === "needs_review" ? "warning" : "neutral"} className="text-[14px]">{item.memo ? MEMO_STATUS_LABEL[item.memo.status] : "No memo"}</Pill></dd></div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}

      <CaseForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
};

export default Deals;
