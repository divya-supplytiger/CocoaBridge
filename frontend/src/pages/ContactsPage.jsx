import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { dbApi } from "../lib/api.js";
import { useCurrentUser } from "../lib/CurrentUserContext.jsx";
import Table from "../components/Table.jsx";
import SearchBar from "../components/SearchBar.jsx";

const ContactsPage = () => {
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === "ADMIN";
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState({ field: null, dir: "asc" });
  const [deleteTarget, setDeleteTarget] = useState(null);

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

  const { mutate: deleteContact, isPending: isDeleting } = useMutation({
    mutationFn: (id) => dbApi.deleteContact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact deleted");
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error ?? "Failed to delete contact");
      setDeleteTarget(null);
    },
  });

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
      accessor: "phone",
      header: "Phone",
      render: (val) => val ?? "—",
    },
    {
      accessor: "buyingOrg",
      header: "Buying Agency",
      render: (_, row) => row.links?.[0]?.buyingOrganization?.name ?? "—",
    },
        {
      accessor: "title",
      header: "Title",
      sortable: true,
      render: (val) => val ?? "—",
    },
    {
      accessor: "status",
      header: "Status",
      render: (_, row) => {
        const isUnlinked = row._count?.links === 0;
        return isUnlinked
          ? <span className="badge badge-warning text-white">Unlinked</span>
          : null;
      },
    },
    ...(isAdmin ? [{
      accessor: "actions",
      header: "",
      render: (_, row) => {
        const isUnlinked = row._count?.links === 0;
        if (!isUnlinked) return null;
        return (
          <button
            className="btn btn-ghost btn-xs text-error"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
            title="Delete unlinked contact"
          >
            <Trash2 className="size-4" />
          </button>
        );
      },
    }] : []),
  ];

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

      {deleteTarget && (
        <dialog open className="modal modal-open">
          <div className="modal-box">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => setDeleteTarget(null)}
            >✕</button>
            <h3 className="font-bold text-lg">Delete Contact</h3>
            <p className="py-4">
              Are you sure you want to delete <strong>{deleteTarget.fullName ?? "this contact"}</strong>? This cannot be undone.
            </p>
            <div className="modal-action">
              <button className="btn btn-accent" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                className="btn btn-error"
                disabled={isDeleting}
                onClick={() => deleteContact(deleteTarget.id)}
              >
                {isDeleting ? <span className="loading loading-spinner loading-xs" /> : "Delete"}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
};

export default ContactsPage;