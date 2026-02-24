import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { dbApi } from "../lib/api.js";
import { Search } from "lucide-react";
import Table from "../components/Table.jsx";

const columns = [
  {
    accessor: "fullName",
    header: "Name",
    render: (val) => val ?? "—",
  },
  {
    accessor: "email",
    header: "Email",
    render: (val) => val ?? "—",
  },
  {
    accessor: "phone",
    header: "Phone",
    render: (val) => val ?? "—",
  },
  {
    accessor: "title",
    header: "Title",
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
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearch(value);
    clearTimeout(window._contactSearchTimer);
    window._contactSearchTimer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  }, []);

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["contacts", page, debouncedSearch],
    queryFn: () => dbApi.listContacts({ page, limit: 50, search: debouncedSearch || undefined }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
                  <Search className="size-4" />

        <input
          type="text"
          placeholder="Search by name or email..."
          className="input input-bordered w-full max-w-sm"
          value={search}
          onChange={handleSearchChange}
          />

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
        basePath="/contacts"
      />
    </div>
  );
};

export default ContactsPage;