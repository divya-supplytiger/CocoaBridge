import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { dbApi } from "../lib/api.js";
import { useCurrentUser } from "../lib/CurrentUserContext.jsx";
import Table from "../components/Table.jsx";
import SearchBar from '../components/SearchBar.jsx';
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
  const [page, setPage] = useState(1);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === "ADMIN";
  const queryClient = useQueryClient();

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["inboxItems", page, debouncedSearch],
    queryFn: () => dbApi.listInboxItems({ page, limit: 50 }),
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
      <SearchBar
        placeholder="Search by title..."
        onSearch={(val) => { setDebouncedSearch(val); setPage(1); }}
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
      />

      {pendingDeleteId && (
        <dialog open className="modal modal-open">
          <div className="modal-box">
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
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setPendingDeleteId(null)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
};

export default InboxPage;