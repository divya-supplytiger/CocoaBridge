import { useState, useCallback } from 'react';
import { useQuery } from "@tanstack/react-query";
import { dbApi } from "../lib/api.js";
import { Search } from "lucide-react";
import Table from "../components/Table.jsx";

const recipientColumns = [
  { accessor: "name", header: "Name", render: (val) => val ?? "—" },
  { accessor: "uei", header: "UEI", render: (val) => val ?? "—" },
  { accessor: "website", header: "Website", render: (val) => val ?? "—" },
];

const buyingOrgColumns = [
  { accessor: "name", header: "Name", render: (val) => val ?? "—" },
  {
    accessor: "level",
    header: "Level",
    render: (val) => val ? <span className="badge badge-primary badge-outline">{val}</span> : "—",
  },
  { accessor: "website", header: "Website", render: (val) => val ?? "—" },
];

const LEVELS = ["AGENCY", "SUBAGENCY", "OFFICE", "OTHER"];

const RecipientsTab = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearch(value);
    clearTimeout(window._recipientSearchTimer);
    window._recipientSearchTimer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  }, []);

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["recipients", page, debouncedSearch],
    queryFn: () => dbApi.listRecipients({ page, limit: 50, search: debouncedSearch || undefined }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Search className="size-4" />
        <input
          type="text"
          placeholder="Search by name or UEI..."
          className="input input-bordered w-full max-w-sm"
          value={search}
          onChange={handleSearchChange}
        />
      </div>
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
        emptyMessage={debouncedSearch ? "No results found" : "No Recipients"}
        emptySubMessage={debouncedSearch ? `No recipients match "${debouncedSearch}".` : "Recipients will appear here once available."}
      />
    </div>
  );
};

const BuyingOrgsTab = () => {
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState("");

  const handleLevelChange = (e) => {
    setLevel(e.target.value);
    setPage(1);
  };

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["buying-orgs", page, level],
    queryFn: () => dbApi.listBuyingOrgs({ page, limit: 50, level: level || undefined }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
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
      <div role="tablist" className="tabs tabs-boxed w-fit">
        <button
          role="tab"
          className={`tab ${activeTab === "recipients" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("recipients")}
        >
          Recipients
        </button>
        <button
          role="tab"
          className={`tab ${activeTab === "buying-orgs" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("buying-orgs")}
        >
          Buying Organizations
        </button>
      </div>

      {activeTab === "recipients" ? <RecipientsTab /> : <BuyingOrgsTab />}
    </div>
  );
};

export default MarketIntelligencePage;
