import { useState, useCallback } from 'react'
import { usePageParam } from "../lib/usePageParam.js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { dbApi } from "../lib/api.js";
import { useCurrentUser } from "../lib/CurrentUserContext.jsx";
import Table from "../components/Table.jsx";
import SearchBar from '../components/SearchBar.jsx';
import ExportToolbar from "../components/ExportToolbar.jsx";

const INBOX_CSV_COLUMNS = [
  { header: "Title", accessor: "title", format: (val) => val ?? "" },
  { header: "Type", accessor: "type", format: (val) => val ?? "" },
  { header: "Review Status", accessor: "reviewStatus", format: (val) => val ?? "" },
  { header: "Acquisition Path", accessor: "acquisitionPath", format: (val) => val ?? "" },
  { header: "Created", accessor: "createdAt", format: (val) => val ? new Date(val).toLocaleDateString() : "" },
];
const STATUS_BADGE = {
  NEW: "badge-neutral",
  IN_REVIEW: "badge-warning",
  QUALIFIED: "badge-success",
  DISMISSED: "badge-error",
  CONTACTED: "badge-info",
  CLOSED: "badge-ghost",
};

const STATUSES = ["NEW", "IN_REVIEW", "QUALIFIED", "DISMISSED", "CONTACTED", "CLOSED"];

const InboxPage = () => {
  const [page, setPage] = usePageParam();
  // pendingDeleteId is the id of the item we're currently confirming deletion for (null if not confirming any)
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState({ field: null, dir: "asc" });
  const [selectedIds, setSelectedIds] = useState(new Set());

  const handleSort = useCallback((field) => {
    setSort((prev) => ({
      field,
      dir: prev.field === field && prev.dir === "asc" ? "desc" : "asc",
    }));
    setPage(1);
    setSelectedIds(new Set());
  }, [setPage]);

  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === "ADMIN";
  const queryClient = useQueryClient();

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["inboxItems", page, debouncedSearch, statusFilter, sort],
    queryFn: () => dbApi.listInboxItems({
      page,
      limit: 50,
      ...(debouncedSearch && { title: debouncedSearch }),
      ...(statusFilter && { status: statusFilter }),
      ...(sort.field && { sortBy: sort.field, sortDir: sort.dir }),
    }),
  });

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ id, body }) => dbApi.updateInboxItem(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inboxItems"] });
      toast.success("Status updated");
    },
    onError: (err) => toast.error(err?.response?.data?.error ?? "Failed to update status"),
  });

  const { mutate: deleteItem, isPending: isDeleting } = useMutation({
    mutationFn: (id) => dbApi.deleteInboxItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inboxItems"] });
      toast.success("Item deleted");
      setPendingDeleteId(null);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error ?? "Failed to delete item");
      setPendingDeleteId(null);
    },
  });

  const columns = [
    { accessor: "title", header: "Title", render: (val) => val ?? "—" },
    { accessor: "type", header: "Type",     render: (val) => val ? <span className="badge badge-info text-white">{val}</span> : "—",
 },
    {
      accessor: "reviewStatus",
      header: "Status",
      render: (val, row) =>
        isAdmin ? (
          <select
            className="select select-xs select-bordered"
            value={val}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              updateStatus({ id: row.id, body: { reviewStatus: e.target.value } });
            }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : (
          <span className={`badge ${STATUS_BADGE[val] ?? "badge-neutral"} bg-white text-black`}>{val}</span>
        ),
    },
    { accessor: "acquisitionPath", header: "Path" },
    {
      accessor: "createdAt",
      header: "Created",
      sortable: true,
      render: (val) => new Date(val).toLocaleDateString(),
    },
    ...(isAdmin ? [{
      accessor: "id",
      header: "",
      render: (val) => (
        <button
          className="btn btn-ghost btn-xs text-error"
          onClick={(e) => {
            e.stopPropagation();
            setPendingDeleteId(val);
          }}
        >
          <Trash2 className="size-4" />
        </button>
      ),
    }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <SearchBar
          placeholder="Search by title..."
          onSearch={(val) => { setDebouncedSearch(val); setSort({ field: null, dir: "asc" }); setPage(1); setSelectedIds(new Set()); }}
        />
        <select
          className="select select-bordered select-sm"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); setSelectedIds(new Set()); }}
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <ExportToolbar
        selectedIds={selectedIds}
        data={result?.data ?? []}
        csvColumns={INBOX_CSV_COLUMNS}
        entityName="inbox-items"
        exportAllFn={dbApi.exportInboxItems}
        filterParams={{ ...(debouncedSearch && { title: debouncedSearch }) }}
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
        basePath="/inbox"
        sort={sort}
        onSort={handleSort}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {pendingDeleteId && (
        <dialog open className="modal modal-open">
          <div className="modal-box">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => setPendingDeleteId(null)}
            >✕</button>
            <h3 className="font-bold text-lg">Delete Inbox Item</h3>
            <p className="py-4">Are you sure you want to delete this inbox item? This cannot be undone.</p>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setPendingDeleteId(null)}>
                Cancel
              </button>
              <button
                className="btn btn-error"
                disabled={isDeleting}
                onClick={() => deleteItem(pendingDeleteId)}
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

export default InboxPage;