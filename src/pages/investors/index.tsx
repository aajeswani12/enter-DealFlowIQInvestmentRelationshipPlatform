import { ChevronRight, FileUp, Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingPanel } from "@/components/common/loading-panel";
import { Pill } from "@/components/common/status-pill";
import { InvestorForm } from "@/components/forms/investor-form";
import { InvestorImport } from "@/components/forms/investor-import";
import { SelectField } from "@/components/forms/select-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  INVESTOR_STATUS_LABEL,
  INVESTOR_STATUS_OPTIONS,
  INVESTOR_TYPE_LABEL,
  INVESTOR_TYPE_OPTIONS,
} from "@/lib/constants";
import { formatCurrencyRange, isOverdue, relativeDays } from "@/lib/format";
import { contactLabel, primaryContact } from "@/lib/investors";
import { EMPTY_WORKSPACE } from "@/lib/workspace";

const Investors = () => {
  const { data, isLoading } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return [...workspace.investors]
      .filter((item) => (type === "all" ? true : item.investorType === type))
      .filter((item) => (status === "all" ? true : item.status === status))
      .filter((item) =>
        search
          ? [
              item.name,
              ...item.stages,
              ...item.sectors,
              ...item.geographies,
              ...item.contacts.flatMap((contact) => [contact.contactName, contact.email ?? "", contact.relationshipOwner]),
            ]
              .join(" ")
              .toLowerCase()
              .includes(search)
          : true,
      )
      .sort((a, b) => {
        const aTime = a.lastContactAt ? new Date(a.lastContactAt).getTime() : 0;
        const bTime = b.lastContactAt ? new Date(b.lastContactAt).getTime() : 0;
        return bTime - aTime || a.name.localeCompare(b.name);
      });
  }, [workspace.investors, query, type, status]);

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        eyebrow="Relationships"
        title="Investor Network"
        description="A hand-maintained record of who backs what. Preferences entered here drive matching; contacts carry their own permission status."
        actions={
          <>
            <Button variant="outline" className="gap-1.5" onClick={() => setImportOpen(true)}>
              <FileUp className="h-4 w-4" aria-hidden="true" />
              Import CSV
            </Button>
            <Button className="gap-1.5" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add investor
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search firm, contact, sector"
            aria-label="Search investors"
            className="bg-card pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:w-[360px]">
          <SelectField
            value={type}
            onChange={setType}
            options={[{ value: "all", label: "All types" }, ...INVESTOR_TYPE_OPTIONS]}
            ariaLabel="Filter by investor type"
          />
          <SelectField
            value={status}
            onChange={setStatus}
            options={[{ value: "all", label: "All statuses" }, ...INVESTOR_STATUS_OPTIONS]}
            ariaLabel="Filter by investor status"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingPanel rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={workspace.investors.length === 0 ? "No investors recorded yet" : "No investors match this filter"}
          description={
            workspace.investors.length === 0
              ? "Add the funds, angels and family offices you actually know, with their stated preferences. Matching only uses those fields."
              : "Try a different search, type or status."
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" className="gap-1.5" onClick={() => setFormOpen(true)}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add investor
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setImportOpen(true)}>
                <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
                Import CSV
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="panel hidden overflow-hidden xl:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Investor network with recorded preferences and next steps</caption>
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  {["Investor", "Type", "Mandate", "Cheque range", "Primary contact", "Last contact", "Next step", ""].map((heading) => (
                    <th
                      key={heading || "open"}
                      scope="col"
                      className="px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((investor) => {
                  const contact = primaryContact(investor);
                  return (
                    <tr key={investor.id} className="border-b border-border/70 transition-colors last:border-0 hover:bg-secondary/30">
                      <td className="px-4 py-3">
                        <Link to={`/investors/${investor.id}`} className="group block">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-[13.5px] font-semibold tracking-tight group-hover:text-brand-strong">
                              {investor.name}
                            </p>
                            {investor.isSynthetic ? <Pill tone="warning">Sample</Pill> : null}
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {INVESTOR_STATUS_LABEL[investor.status]} · {investor.currency}
                          </p>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">
                        {INVESTOR_TYPE_LABEL[investor.investorType]}
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        <p className="text-[12px] font-medium">{investor.stages.join(", ") || "No stage preference"}</p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                          {investor.sectors.join(", ") || "No sector preference"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[12px] tabular-nums">
                        {formatCurrencyRange(investor.checkMin, investor.checkMax, investor.currency)}
                      </td>
                      <td className="max-w-[170px] px-4 py-3">
                        <p className="truncate text-[12px] font-medium">{contactLabel(contact)}</p>
                        <p className="truncate text-[10.5px] text-muted-foreground">{contact?.email || "No email recorded"}</p>
                      </td>
                      <td className="px-4 py-3 text-[11.5px] text-muted-foreground">
                        {relativeDays(investor.lastContactAt)}
                      </td>
                      <td className="max-w-[180px] px-4 py-3">
                        <p className="line-clamp-2 text-[12px] leading-relaxed text-foreground/90">
                          {investor.nextStep || "No next step"}
                        </p>
                        {investor.nextStepDue ? (
                          <p className={isOverdue(investor.nextStepDue) ? "mt-0.5 text-[10.5px] font-medium text-destructive" : "mt-0.5 text-[10.5px] text-muted-foreground"}>
                            {isOverdue(investor.nextStepDue) ? "Overdue" : "Scheduled"}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/investors/${investor.id}`}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-medium text-brand-strong hover:bg-brand-soft"
                        >
                          Open
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 xl:hidden">
            {rows.map((investor) => {
              const contact = primaryContact(investor);
              return (
                <li key={investor.id}>
                  <Link to={`/investors/${investor.id}`} className="panel block p-4 transition-shadow hover:shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold tracking-tight">{investor.name}</p>
                        <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                          {contactLabel(contact)}
                          {contact?.email ? ` · ${contact.email}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Pill tone="neutral">{INVESTOR_STATUS_LABEL[investor.status]}</Pill>
                        {investor.isSynthetic ? <Pill tone="warning">Sample</Pill> : null}
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
                      <div>
                        <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Cheque</dt>
                        <dd className="mt-0.5 font-medium tabular-nums">
                          {formatCurrencyRange(investor.checkMin, investor.checkMax, investor.currency)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Last contact</dt>
                        <dd className="mt-0.5 font-medium">{relativeDays(investor.lastContactAt)}</dd>
                      </div>
                    </dl>
                    <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
                      {investor.stages.join(", ") || "No stage preference"} ·{" "}
                      {investor.sectors.join(", ") || "No sector preference"}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <InvestorForm open={formOpen} onOpenChange={setFormOpen} />
      <InvestorImport open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
};

export default Investors;
