import { useState, useCallback } from 'react';
import { useQuery } from "@tanstack/react-query";
import { dbApi } from "../lib/api.js";
import Table from "../components/Table.jsx";
import SearchBar from "../components/SearchBar.jsx";

const columns = [
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

const Awards = () => {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: "", naics: "", psc: "" });
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

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["awards", page, filters, sort],
    queryFn: () => dbApi.listAwards({
      page,
      limit: 50,
      ...(filters.search && { search: filters.search }),
      ...(filters.naics && { naics: filters.naics }),
      ...(filters.psc && { psc: filters.psc }),
      ...(sort.field && { sortBy: sort.field, sortDir: sort.dir }),
    }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <SearchBar onSearch={updateFilter("search")} placeholder="Search description…" />
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
        basePath="/awards"
        sort={sort}
        onSort={handleSort}
      />
    </div>
  );
};

export default Awards;
