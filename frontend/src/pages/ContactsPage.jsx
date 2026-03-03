import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { dbApi } from "../lib/api.js";
import Table from "../components/Table.jsx";
import SearchBar from "../components/SearchBar.jsx";

const columns = [
  {
    accessor: "fullName",
    header: "Name",
    sortable: true,
    render: (val) => val ?? "—",
  },
  {
    accessor: "email",
    header: "Email",
    sortable: true,
    render: (val) => val ?? "—",
  },
  {
    accessor: "title",
    header: "Title",
    sortable: true,
    render: (val) => val ?? "—",
  },
  {
    accessor: "buyingOrg",
    header: "Buying Agency",
    render: (_, row) => row.links?.[0].buyingOrganization?.name ?? "—",
  },
];

const ContactsPage = () => {
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
    queryKey: ["contacts", page, debouncedSearch, sort],
    queryFn: () => dbApi.listContacts({
      page,
      limit: 50,
      search: debouncedSearch || undefined,
      ...(sort.field && { sortBy: sort.field, sortDir: sort.dir }),
    }),
  });

  return (
    <div className="flex flex-col gap-4">
      <SearchBar
        placeholder="Search by name or email..."
        onSearch={(val) => { setDebouncedSearch(val); setSort({ field: null, dir: "asc" }); setPage(1); }}
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
        basePath="/contacts"
        sort={sort}
        onSort={handleSort}
        emptyMessage={debouncedSearch ? "No results found" : "No Contacts"}
        emptySubMessage={debouncedSearch ? `No contacts match "${debouncedSearch}".` : "Contacts will appear here once available."}
      />
    </div>
  );
};

export default ContactsPage;