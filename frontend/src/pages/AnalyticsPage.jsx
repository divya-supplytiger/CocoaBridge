import { useState } from "react";
import { useLocalStorage } from "../lib/useLocalStorage.js";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { analyticsApi } from "../lib/api.js";
import { Link } from "react-router";
import TabsJoinButton from "../components/TabsJoinButton.jsx";
import PaginationButton from "../components/PaginationButton.jsx";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  n == null ? "—" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const OPP_TYPES = [
  "SOLICITATION",
  "PRE_SOLICITATION",
  "SOURCES_SOUGHT",
  "AWARD_NOTICE",
  "SPECIAL_NOTICE",
  "OTHER",
];

const TYPE_LABELS = {
  SOLICITATION: "SOL",
  PRE_SOLICITATION: "PRE",
  SOURCES_SOUGHT: "SS",
  AWARD_NOTICE: "AWD",
  SPECIAL_NOTICE: "SPC",
  OTHER: "OTH",
};

const Bar = ({ value, max }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-20 h-1.5 bg-base-300 rounded-full overflow-hidden">
      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
};

const SectionShell = ({ title, subtitle, children }) => (
  <section className="card bg-base-100 shadow-sm border border-base-300">
    <div className="card-body gap-4">
      <div>
        <h2 className="card-title text-base">{title}</h2>
        {subtitle && <p className="text-sm opacity-60">{subtitle}</p>}
      </div>
      {children}
    </div>
  </section>
);

const AnalyticsTable = ({ columns, data, keyField = "id" }) => (
  <div className="overflow-x-auto">
    <table className="table table-sm w-full">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.accessor} className={`${col.className ?? ""} text-accent-content`}>
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row[keyField]} className="hover">
            {columns.map((col) => (
              <td key={col.accessor} className={`${col.cellClassName ?? ""} text-accent-content/80`}>
                {col.render ? col.render(row[col.accessor], row) : row[col.accessor]}
              </td>
            ))}
          </tr>
        ))}
        {data.length === 0 && (
          <tr>
            <td colSpan={columns.length} className="text-center text-sm opacity-50 py-6">
              No data
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const SectionLoader = () => (
  <div className="flex justify-center py-8">
    <Loader2 className="size-6 animate-spin opacity-50" />
  </div>
);

const SectionError = () => (
  <p className="text-sm text-error py-4">Failed to load data.</p>
);

// ─── Section 1: Top Recipients ────────────────────────────────────────────────

const RecipientAnalytics = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics-recipients", page],
    queryFn: () => analyticsApi.getRecipients({ page }),
  });

  if (isLoading) return <SectionLoader />;
  if (isError) return <SectionError />;

  const raw = data?.data ?? [];
  const meta = data?.meta;
  const offset = ((meta?.page ?? 1) - 1) * (meta?.limit ?? 25);
  const max = page === 1 ? (raw[0]?.totalObligated ?? 0) : null;
  const rows = raw.map((r, i) => ({ ...r, id: r.recipientId, rank: offset + i + 1 }));

  const columns = [
    { accessor: "rank", header: "#", cellClassName: "opacity-40 text-xs w-8" },
    {
      accessor: "name",
      header: "Recipient",
      render: (val, row) => (
        <Link to={`/recipients/${row.id}`} className="link link-hover font-medium text-sm">{val}</Link>
      ),
    },
    { accessor: "uei", header: "UEI", cellClassName: "text-xs opacity-60", render: (val) => val ?? "—" },
    { accessor: "awardCount", header: "Awards", className: "text-right", cellClassName: "text-right text-sm", render: (val) => val.toLocaleString() },
    { accessor: "totalObligated", header: "Total Obligated", className: "text-right", cellClassName: "text-right text-sm font-medium", render: (val) => fmt(val) },
    { accessor: "_bar", header: "", render: (_, row) => <Bar value={row.totalObligated} max={max} />, cellClassName: "w-24" },
  ];

  return (
    <>
      <AnalyticsTable columns={columns} data={rows} />
      {meta?.totalPages > 1 && (
        <PaginationButton totalPages={meta.totalPages} currentPage={meta.page} onPageChange={setPage} size="sm" />
      )}
    </>
  );
};

// ─── Section 2 & 3: PSC / NAICS ──────────────────────────────────────────────

const CodeAnalytics = ({ queryKey, queryFn, codeLabel }) => {
  const [sortBy, setSortBy] = useState("totalObligated");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useQuery({
    queryKey: [queryKey, sortBy, page],
    queryFn: () => queryFn({ sortBy, page }),
  });

  if (isLoading) return <SectionLoader />;
  if (isError) return <SectionError />;

  const raw = data?.data ?? [];
  const meta = data?.meta;
  const offset = ((meta?.page ?? 1) - 1) * (meta?.limit ?? 25);
  const max = Math.max(...raw.map((r) => r.totalObligated), 0);
  const tableData = raw.map((r, i) => ({ ...r, id: r.pscCode ?? r.naics, code: r.pscCode ?? r.naics, rank: offset + i + 1 }));

  const columns = [
    { accessor: "rank", header: "#", cellClassName: "opacity-40 text-xs w-8" },
    { accessor: "code", header: codeLabel, cellClassName: "font-mono text-sm" },
    { accessor: "oppCount", header: "Opps", className: "text-right", cellClassName: "text-right text-sm", render: (val) => val.toLocaleString() },
    { accessor: "awardCount", header: "Awards", className: "text-right", cellClassName: "text-right text-sm", render: (val) => val.toLocaleString() },
    { accessor: "totalObligated", header: "Total Obligated", className: "text-right", cellClassName: "text-right text-sm font-medium", render: (val) => fmt(val) },
    { accessor: "_bar", header: "", cellClassName: "w-24", render: (_, row) => <Bar value={row.totalObligated} max={max} /> },
  ];

  return (
    <>
      <div className="join">
        {[
          { key: "totalObligated", label: "By Award $" },
          { key: "oppCount", label: "By Opp Count" },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`join-item btn btn-xs ${sortBy === key ? "btn-primary" : "btn-ghost border border-base-300"}`}
            onClick={() => { setSortBy(key); setPage(1); }}
          >
            {label}
          </button>
        ))}
      </div>
      <AnalyticsTable columns={columns} data={tableData} />
      {meta?.totalPages > 1 && (
        <PaginationButton totalPages={meta.totalPages} currentPage={meta.page} onPageChange={setPage} size="sm" />
      )}
    </>
  );
};

// ─── Section 4: Agencies ──────────────────────────────────────────────────────

const ORG_LEVELS = ["AGENCY", "SUBAGENCY", "OFFICE", "OTHER"];

const AgencyAnalytics = () => {
  const [level, setLevel] = useState("AGENCY");
  const [sortBy, setSortBy] = useState("awardTotal");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics-agencies", level, sortBy, page],
    queryFn: () => analyticsApi.getAgencies({ level, sortBy, page }),
  });

  if (isLoading) return <SectionLoader />;
  if (isError) return <SectionError />;

  const raw = data?.data ?? [];
  const meta = data?.meta;
  const offset = ((meta?.page ?? 1) - 1) * (meta?.limit ?? 25);

  const columns = [
    { accessor: "rank", header: "#", cellClassName: "opacity-40 text-xs w-8" },
    {
      accessor: "name",
      header: "Agency",
      render: (val, row) => (
        <>
          <Link to={`/buying-orgs/${row.id}`} className="link link-hover font-medium text-sm">{val}</Link>
          {row.level && <span className="badge badge-ghost badge-xs ml-1.5 opacity-60">{row.level}</span>}
        </>
      ),
    },
    { accessor: "oppCount", header: "Total Opps", className: "text-right", cellClassName: "text-right text-sm font-medium", render: (val) => val.toLocaleString() },
    ...OPP_TYPES.map((t) => ({
      accessor: `type_${t}`,
      header: TYPE_LABELS[t],
      className: "text-right text-xs opacity-60",
      cellClassName: "text-right text-xs opacity-70",
      render: (val) => val ? val.toLocaleString() : "—",
    })),
    { accessor: "awardCount", header: "Awards", className: "text-right", cellClassName: "text-right text-sm", render: (val) => val.toLocaleString() },
    { accessor: "awardTotal", header: "Award Total", className: "text-right", cellClassName: "text-right text-sm", render: (val) => fmt(val) },
  ];

  const tableData = raw.map((r, i) => ({
    ...r,
    id: r.orgId,
    rank: offset + i + 1,
    ...Object.fromEntries(OPP_TYPES.map((t) => [`type_${t}`, r.oppsByType?.[t]])),
  }));

  return (
    <>
      <div className="flex items-center gap-2">
        <select
          className="select select-bordered select-xs"
          value={level}
          onChange={(e) => { setLevel(e.target.value); setPage(1); }}
        >
          {ORG_LEVELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <div className="join">
          {[
            { key: "awardTotal", label: "By Award $" },
            { key: "oppCount", label: "By Opp Count" },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`join-item btn btn-xs ${sortBy === key ? "btn-primary" : "btn-ghost border border-base-300"}`}
              onClick={() => { setSortBy(key); setPage(1); }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <AnalyticsTable columns={columns} data={tableData} />
      {meta?.totalPages > 1 && (
        <PaginationButton totalPages={meta.totalPages} currentPage={meta.page} onPageChange={setPage} size="sm" />
      )}
    </>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const AnalyticsPage = () => {
  const tabs = [
    { label: "Top Recipients", value: "recipients" },
    { label: "By PSC Code", value: "psc" },
    { label: "By NAICS Code", value: "naics" },
    { label: "By Agency", value: "agencies" },
  ];
  const [activeTab, setActiveTab] = useLocalStorage("st:tab:analytics", tabs[0].value);

  return (
  <div className="flex flex-col gap-4">
    <TabsJoinButton tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />

    {activeTab === "recipients" && (
      <SectionShell
        title="Top Recipients"
        subtitle="Award recipients ranked by total obligated amount."
      >
        <RecipientAnalytics />
      </SectionShell>
    )}

    {activeTab === "psc" && (
      <SectionShell
        title="By PSC Code"
        subtitle="Opportunity counts and award spend grouped by Product Service Code."
      >
        <CodeAnalytics
          queryKey="analytics-psc"
          queryFn={analyticsApi.getPsc}
          codeLabel="PSC Code"
        />
      </SectionShell>
    )}

    {activeTab === "naics" && (
      <SectionShell
        title="By NAICS Code"
        subtitle="Opportunity counts and award spend grouped by NAICS code."
      >
        <CodeAnalytics
          queryKey="analytics-naics"
          queryFn={analyticsApi.getNaics}
          codeLabel="NAICS Code"
        />
      </SectionShell>
    )}

    {activeTab === "agencies" && (
      <SectionShell
        title="By Agency"
        subtitle="Buying organizations ranked by activity, with opportunity type breakdown."
      >
        <AgencyAnalytics />
      </SectionShell>
    )}
  </div>
);
}

export default AnalyticsPage;
