import { useState, useCallback, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { useLocalStorage } from "../lib/useLocalStorage.js";
import { dbApi } from "../lib/api.js";
import Table from "../components/Table.jsx";
import SearchBar from "../components/SearchBar.jsx";
import FavoriteButton from "../components/FavoriteButton.jsx";
import TabsJoinButton from "../components/TabsJoinButton.jsx";
const Opportunities = () => {
  const [page, setPage] = useState(1);
  const tabs = [
    { label: "All", value: "all" },
    { label: "Favorites", value: "favorites" },
  ];
  const [activeTab, setActiveTab] = useLocalStorage("st:tab:opportunities", tabs[0].value);
  const [filters, setFilters] = useState({ search: "", naics: "", psc: "", favoritesOnly: activeTab === "favorites" });
  const [sort, setSort] = useState({ field: null, dir: "asc" });

  const updateFilter = useCallback((key) => (value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setSort({ field: null, dir: "asc" });
    setPage(1);
  }, []);

  const handleSort = useCallback((field) => {
    setSort((prev) => ({
      field,
      dir: prev.field === field && prev.dir === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setFilters((prev) => ({ ...prev, favoritesOnly: tab === "favorites" }));
    setPage(1);
  };

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["opportunities", page, filters, sort],
    queryFn: () => dbApi.listOpportunities({
      page,
      limit: 50,
      ...(filters.search && { search: filters.search }),
      ...(filters.naics && { naics: filters.naics }),
      ...(filters.psc && { psc: filters.psc }),
      ...(filters.favoritesOnly && { favoritesOnly: true }),
      ...(sort.field && { sortBy: sort.field, sortDir: sort.dir }),
    }),
  });

  const { data: favoritesData } = useQuery({
    queryKey: ["favorites"],
    queryFn: dbApi.listFavorites,
  });

  const favoriteIds = useMemo(() => {
    return new Set((favoritesData?.opportunities ?? []).map((o) => o.id));
  }, [favoritesData]);

  const columns = [
    {
      accessor: "id",
      header: "",
      render: (val) => (
        <FavoriteButton entityType="opportunity" entityId={val} isFavorited={favoriteIds.has(val)} />
      ),
    },
    { accessor: "title", header: "Title", sortable: true },
    {
      accessor: "pscCode",
      header: "PSC",
      sortable: true,
      render: (val) => val ?? "—",
    },
    {
      accessor: "naicsCodes",
      header: "NAICS Codes",
      render: (val) => val?.length > 0 ? val.join(", ") : "—",
    },
    {
      accessor: "responseDeadline",
      header: "Deadline",
      sortable: true,
      render: (val) => (val ? new Date(val).toLocaleDateString() : "—"),
    },
    {
      accessor: "setAside",
      header: "Set Aside",
      render: (val) => val ? <span className="badge badge-warning text-white">{val}</span> : "—",
    },
    {
      accessor: "type",
      header: "Type",
      render: (val) => val ? <span className="badge badge-info text-white">{val}</span> : "—",
    },
    {
      accessor: "state",
      header: "State",
      render: (val) => val ? <span className="badge badge-primary text-white">{val}</span> : "—",
    },
    {
      accessor: "active",
      header: "Status",
      render: (val) => (
        <span className={`badge ${val ? "badge-success" : "badge-error"} text-white`}>
          {val ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
              <TabsJoinButton tabs={tabs} activeTab={activeTab} setActiveTab={handleTabChange} />

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar onSearch={updateFilter("search")} placeholder="Search title & description…" />
        <SearchBar onSearch={updateFilter("naics")} placeholder="NAICS code…" className="max-w-[180px]" />
        <SearchBar onSearch={updateFilter("psc")} placeholder="PSC prefix…" className="max-w-[160px]" />
      </div>
      <Table
        columns={columns}
        data={result?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        meta={result?.meta}
        page={page}
        onPageChange={setPage}
        basePath="/opportunities"
        sort={sort}
        onSort={handleSort}
        emptyMessage={filters.favoritesOnly ? "No favorited opportunities" : undefined}
        emptySubMessage={filters.favoritesOnly ? "Star an opportunity to save it here." : undefined}
      />
    </div>
  );
};

export default Opportunities;
