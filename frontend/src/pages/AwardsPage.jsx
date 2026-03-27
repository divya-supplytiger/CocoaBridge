import { useState, useCallback, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { dbApi } from "../lib/api.js";
import { useLocalStorage } from "../lib/useLocalStorage.js";
import Table from "../components/Table.jsx";
import SearchBar from "../components/SearchBar.jsx";
import FavoriteButton from "../components/FavoriteButton.jsx";
import TabsJoinButton from "../components/TabsJoinButton.jsx";
import ExportToolbar from "../components/ExportToolbar.jsx";

const AWARD_CSV_COLUMNS = [
  { header: "Award ID", accessor: "externalId", format: (val) => val ? val.split("_")[2] : "" },
  { header: "Description", accessor: "description", format: (val) => val ?? "" },
  { header: "Amount", accessor: "obligatedAmount", format: (val) => val != null ? `$${Number(val).toFixed(2)}` : "" },
  { header: "PSC", accessor: "pscCode", format: (val) => val ?? "" },
  { header: "NAICS", accessor: "naicsCodes", format: (val) => val?.join(", ") ?? "" },
  { header: "Start Date", accessor: "startDate", format: (val) => val ? new Date(val).toLocaleDateString() : "" },
  { header: "End Date", accessor: "endDate", format: (val) => val ? new Date(val).toLocaleDateString() : "" },
];

const Awards = () => {
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const tabs = [
    { label: "All", value: "all" },
    { label: "Favorites", value: "favorites" },
  ];
  const [activeTab, setActiveTab] = useLocalStorage("st:tab:awards", tabs[0].value);
  const [filters, setFilters] = useState({ search: "", naics: "", psc: "", favoritesOnly: activeTab === "favorites" });
  const [sort, setSort] = useState({ field: null, dir: "asc" });

  const updateFilter = useCallback((key) => (value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setSort({ field: null, dir: "asc" });
    setPage(1);
    setSelectedIds(new Set());
  }, []);

  const handleSort = useCallback((field) => {
    setSort((prev) => ({
      field,
      dir: prev.field === field && prev.dir === "asc" ? "desc" : "asc",
    }));
    setPage(1);
    setSelectedIds(new Set());
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setFilters((prev) => ({ ...prev, favoritesOnly: tab === "favorites" }));
    setPage(1);
    setSelectedIds(new Set());
  }

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["awards", page, filters, sort],
    queryFn: () => dbApi.listAwards({
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
    return new Set((favoritesData?.awards ?? []).map((a) => a.id));
  }, [favoritesData]);

  const columns = [
    {
      accessor: "id",
      header: "",
      render: (val) => (
        <FavoriteButton entityType="award" entityId={val} isFavorited={favoriteIds.has(val)} />
      ),
    },
    {
      accessor: "description",
      header: "Description",
      render: (val) => val && val.length > 60 ? `${val.slice(0, 60)}…` : (val ?? "—"),
    },
    {
      accessor: "obligatedAmount",
      header: "Amount",
      sortable: true,
      render: (val) => val ? `$${Number(val).toLocaleString()}` : "—",
    },
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
      accessor: "startDate",
      header: "Start",
      sortable: true,
      render: (val) => val ? new Date(val).toLocaleDateString() : "—",
    },
    {
      accessor: "endDate",
      header: "End",
      sortable: true,
      render: (val) => val ? new Date(val).toLocaleDateString() : "—",
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <TabsJoinButton tabs={tabs} activeTab={activeTab} setActiveTab={handleTabChange} />

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar onSearch={updateFilter("search")} placeholder="Search description…" />
        <SearchBar onSearch={updateFilter("naics")} placeholder="NAICS code…" className="max-w-[180px]" />
        <SearchBar onSearch={updateFilter("psc")} placeholder="PSC prefix…" className="max-w-[160px]" />
          
      </div>

          <ExportToolbar
        selectedIds={selectedIds}
        data={result?.data ?? []}
        csvColumns={AWARD_CSV_COLUMNS}
        entityName="awards"
        exportAllFn={dbApi.exportAwards}
        filterParams={{
          ...(filters.search && { search: filters.search }),
          ...(filters.naics && { naics: filters.naics }),
          ...(filters.psc && { psc: filters.psc }),
          ...(filters.favoritesOnly && { favoritesOnly: true }),
        }}
      />
      <Table
        columns={columns}
        data={result?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        meta={result?.meta}
        page={page}
        onPageChange={setPage}
        basePath="/awards"
        sort={sort}
        onSort={handleSort}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        emptyMessage={filters.favoritesOnly ? "No favorited awards" : undefined}
        emptySubMessage={filters.favoritesOnly ? "Star an award to save it here." : undefined}
      />
    </div>
  );
};

export default Awards;
