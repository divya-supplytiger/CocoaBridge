import { useState, useCallback } from 'react';
import { useQuery } from "@tanstack/react-query";
import { dbApi } from "../lib/api.js";
import Table from "../components/Table.jsx";
import SearchBar from "../components/SearchBar.jsx";

const recipientColumns = [
  { accessor: "name", header: "Name", sortable: true, render: (val) => val ?? "—" },
  { accessor: "uei", header: "UEI", render: (val) => val ?? "—" },
  { accessor: "website", header: "Website", render: (val) => val ?? "—" },
];

const buyingOrgColumns = [
  { accessor: "name", header: "Name", sortable: true, render: (val) => val ?? "—" },
  {
    accessor: "level",
    header: "Level",
    render: (val) => val ? <span className="badge badge-primary">{val}</span> : "—",
  },
  { accessor: "website", header: "Website", render: (val) => val ?? "—" },
];

const LEVELS = ["AGENCY", "SUBAGENCY", "OFFICE", "OTHER"];

const RecipientsTab = () => {
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState({ field: null, dir: "asc" });

  const handleSort = useCallback((field) => {
    setSort((prev) => ({
      field,
      dir: prev.field === field && prev.dir === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  }, []);

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["recipients", page, debouncedSearch, sort],
    queryFn: () => dbApi.listRecipients({
      page,
      limit: 50,
      search: debouncedSearch || undefined,
      ...(sort.field && { sortBy: sort.field, sortDir: sort.dir }),
    }),
  });

  return (
    <div className="flex flex-col gap-4">
      <SearchBar
        placeholder="Search by name or UEI..."
        onSearch={(val) => { setDebouncedSearch(val); setSort({ field: null, dir: "asc" }); setPage(1); }}
      />
      <Table
        columns={recipientColumns}
        data={result?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        meta={result?.meta}
        page={page}
        onPageChange={setPage}
        basePath="/recipients"
        sort={sort}
        onSort={handleSort}
        emptyMessage={debouncedSearch ? "No results found" : "No Recipients"}
        emptySubMessage={debouncedSearch ? `No recipients match "${debouncedSearch}".` : "Recipients will appear here once available."}
      />
    </div>
  );
};

const BuyingOrgsTab = () => {
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState({ field: null, dir: "asc" });

  const handleSort = useCallback((field) => {
    setSort((prev) => ({
      field,
      dir: prev.field === field && prev.dir === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  }, []);

  const handleLevelChange = (e) => {
    setLevel(e.target.value);
    setSort({ field: null, dir: "asc" });
    setPage(1);
  };

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["buying-orgs", page, level, debouncedSearch, sort],
    queryFn: () => dbApi.listBuyingOrgs({
      page,
      limit: 50,
      level: level || undefined,
      search: debouncedSearch || undefined,
      ...(sort.field && { sortBy: sort.field, sortDir: sort.dir }),
    }),
  });

  return (
    <div className="flex flex-col gap-4">

      <div className="flex items-center gap-2">
            <SearchBar
        placeholder="Search by name..."
        onSearch={(val) => { setDebouncedSearch(val); setSort({ field: null, dir: "asc" }); setPage(1); }}
      />
        <select
          className="select select-bordered"
          value={level}
          onChange={handleLevelChange}
        >
          <option value="">All Levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>
      <Table
        columns={buyingOrgColumns}
        data={result?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        meta={result?.meta}
        page={page}
        onPageChange={setPage}
        basePath="/buying-orgs"
        sort={sort}
        onSort={handleSort}
        emptyMessage="No Buying Organizations"
        emptySubMessage="Buying organizations will appear here once available."
      />
    </div>
  );
};

const MarketIntelligencePage = () => {
  const [activeTab, setActiveTab] = useState("recipients");

  return (
    <div className="flex flex-col gap-4">
      <div className="join">
        <button
          className={`join-item btn btn-sm ${activeTab === "recipients" ? "btn-primary" : "btn-ghost hover:bg-accent-content/40 border border-accent-content/40"}`}
          onClick={() => setActiveTab("recipients")}
        >
          Recipients
        </button>
        <button
          className={`join-item btn btn-sm ${activeTab === "buying-orgs" ? "btn-primary" : "btn-ghost hover:bg-accent-content/40 border border-accent-content/40"}`}
          onClick={() => setActiveTab("buying-orgs")}
        >
          Buying Agencies
        </button>
      </div>

      {activeTab === "recipients" ? <RecipientsTab /> : <BuyingOrgsTab />}
    </div>
  );
};

export default MarketIntelligencePage;
