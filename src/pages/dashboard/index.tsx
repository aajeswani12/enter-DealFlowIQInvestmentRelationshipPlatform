import { ArrowRight, FileText, FolderInput, Mic, PenLine, UserRoundSearch } from "lucide-react";
import { Link } from "react-router-dom";
import { LoadingPanel } from "@/components/common/loading-panel";
import { Pill } from "@/components/common/status-pill";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatShortDate } from "@/lib/format";
import { EMPTY_WORKSPACE } from "@/lib/workspace";

const ACTIONS = [
  {
    title: "Create Memo",
    description: "Turn existing information into a draft.",
    to: "/create-memo",
    icon: PenLine,
  },
  {
    title: "Find Investors",
    description: "Find potential matches for a deal.",
    to: "/find-investors",
    icon: UserRoundSearch,
  },
  {
    title: "Import Files",
    description: "Add emails, notes and pitch decks.",
    to: "/imports",
    icon: FolderInput,
  },
  {
    title: "Add Voice Note",
    description: "Record an update to a deal.",
    to: "/inbox/capture",
    icon: Mic,
  },
];

const MEMO_STATUS_LABEL = {
  draft: "Draft",
  needs_review: "Needs Review",
  approved: "Approved",
} as const;

interface ReviewItem {
  id: string;
  date: string;
  dealName: string;
  what: string;
  action: string;
  to: string;
}

function candidateName(value: string | null | undefined): string {
  return value?.trim() || "Imported record";
}

const Home = () => {
  const { data, isLoading, isError } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;

  const latestMemoByDeal = new Map<string, (typeof workspace.dealMemos)[number]>();
  for (const memo of [...workspace.dealMemos].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())) {
    if (!latestMemoByDeal.has(memo.dealId)) latestMemoByDeal.set(memo.dealId, memo);
  }

  const reviewItems: ReviewItem[] = [
    ...[...latestMemoByDeal.values()]
      .filter((memo) => memo.content.trim().length > 0 && memo.status !== "approved")
      .map((memo) => {
        const deal = workspace.cases.find((item) => item.id === memo.dealId);
        return {
          id: `memo-${memo.id}`,
          date: memo.updatedAt,
          dealName: deal?.companyName ?? "Unknown deal",
          what: `Memo: ${memo.title || "Untitled"} · ${MEMO_STATUS_LABEL[memo.status]}`,
          action: "Open memo",
          to: `/cases/${memo.dealId}#memo`,
        };
      }),
    ...workspace.claims
      .filter((claim) => claim.reviewStatus === "draft" && !claim.supersededBy)
      .map((claim) => {
        const deal = workspace.cases.find((item) => item.id === claim.dealId);
        return {
          id: `claim-${claim.id}`,
          date: claim.createdAt,
          dealName: deal?.companyName ?? "Unknown deal",
          what: `Claim review: ${claim.label}`,
          action: "Review claim",
          to: `/cases/${claim.dealId}#claims-heading`,
        };
      }),
    ...workspace.importCandidates
      .filter(
        (candidate) =>
          candidate.status === "needs_review" ||
          (candidate.entityType === "claim" && candidate.status === "pending"),
      )
      .map((candidate) => {
        const deal = workspace.cases.find(
          (item) =>
            item.id === candidate.dealId ||
            item.id === candidate.proposedDealId ||
            item.id === String(candidate.payload.company_id ?? ""),
        );
        return {
          id: `import-${candidate.id}`,
          date: candidate.updatedAt,
          dealName: deal?.companyName ?? candidateName(String(candidate.payload.company_name ?? candidate.payload.name ?? "")),
          what: `Import approval: ${candidateName(String(candidate.payload.name ?? candidate.payload.label ?? "Imported record"))}`,
          action: "Review import",
          to: "/imports",
        };
      }),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const recentDeals = [...workspace.cases]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-8">
      <header>
        <h1 className="text-[32px] font-bold leading-tight tracking-tight">Good morning</h1>
        <p className="mt-1 text-[18px] leading-[1.5] text-muted-foreground">What would you like to work on?</p>
      </header>

      <section aria-label="Start a workflow" className="grid gap-4 sm:grid-cols-2">
        {ACTIONS.map((action) => (
          <Link
            key={action.title}
            to={action.to}
            className="group flex min-h-[150px] items-start gap-5 rounded-xl border border-border bg-card p-6 shadow-card transition-colors hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
              <action.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-[21px] font-semibold tracking-tight">
                {action.title}
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
              <span className="mt-1 block max-w-[32ch] text-[17px] leading-[1.5] text-muted-foreground">{action.description}</span>
            </span>
          </Link>
        ))}
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <section className="space-y-3" aria-labelledby="review-heading">
          <div>
            <h2 id="review-heading" className="text-[21px] font-semibold tracking-tight">Ready for Your Review</h2>
            <p className="mt-1 text-[14px] text-muted-foreground">Only items already waiting on a human decision.</p>
          </div>
          {isLoading ? (
            <LoadingPanel rows={2} />
          ) : isError ? (
            <p className="rounded-lg border border-destructive/20 bg-danger-soft px-4 py-3 text-[16px] text-destructive">
              Review items could not be loaded. Nothing was changed.
            </p>
          ) : reviewItems.length === 0 ? (
            <p className="rounded-xl border border-border bg-card px-5 py-6 text-[17px] text-muted-foreground">You're all caught up</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
              <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] gap-4 border-b border-border bg-secondary/40 px-5 py-3 text-[14px] font-semibold text-muted-foreground md:grid">
                <span>Deal name</span><span>What needs review</span><span>Open action</span>
              </div>
              <ul className="divide-y divide-border">
                {reviewItems.map((item) => (
                  <li key={item.id} className="grid gap-2 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] md:items-center md:gap-4">
                    <span className="text-[17px] font-medium">{item.dealName}</span>
                    <span className="text-[16px] text-muted-foreground">{item.what}</span>
                    <Link to={item.to} className="inline-flex items-center gap-1 text-[16px] font-medium text-brand-strong hover:underline">
                      {item.action}<ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="space-y-3" aria-labelledby="recent-deals-heading">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="recent-deals-heading" className="text-[21px] font-semibold tracking-tight">Recent Deals</h2>
              <p className="mt-1 text-[14px] text-muted-foreground">Most recently updated folders.</p>
            </div>
            <Link to="/cases" className="text-[16px] text-brand-strong hover:underline">All deals</Link>
          </div>
          {isLoading ? (
            <LoadingPanel rows={2} />
          ) : isError ? (
            <p className="text-[16px] text-destructive">Deals could not be loaded.</p>
          ) : recentDeals.length === 0 ? (
            <p className="rounded-xl border border-border bg-card px-5 py-6 text-[17px] text-muted-foreground">No deals yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card px-5 shadow-card">
              {recentDeals.map((deal) => {
                const memo = latestMemoByDeal.get(deal.id);
                return (
                  <li key={deal.id} className="py-4 first:pt-5 last:pb-5">
                    <Link to={`/cases/${deal.id}`} className="group block">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[17px] font-medium group-hover:text-brand-strong">{deal.companyName}</span>
                        <Pill tone={memo?.status === "approved" ? "success" : memo?.status === "needs_review" ? "warning" : "neutral"} className="text-[14px]">
                          {memo ? MEMO_STATUS_LABEL[memo.status] : "No memo"}
                        </Pill>
                      </div>
                      <p className="mt-1 text-[14px] text-muted-foreground">Updated {formatShortDate(deal.updatedAt)}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default Home;
