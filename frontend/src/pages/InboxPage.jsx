import { useState, useCallback } from 'react'
import { usePageParam } from "../lib/usePageParam.js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { dbApi } from "../lib/api.js";
import { useCurrentUser } from "../lib/CurrentUserContext.jsx";
import Table from "../components/Table.jsx";
import SearchBar from '../components/SearchBar.jsx';
import ExportToolbar from "../components/ExportToolbar.jsx";
import TabsJoinButton from "../components/TabsJoinButton.jsx";

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

function SignalPills({ signals }) {
  if (!signals || signals.length === 0) return <span className="text-base-content/40 text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {signals.map((s, i) => (
        <span key={i} className="badge badge-sm badge-outline text-xs" title={s.type}>
          {s.value}
        </span>
      ))}
    </div>
  );
}

function PendingReviewTab({ isAdmin }) {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const [pendingDismissId, setPendingDismissId] = useState(null);

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["scoringQueueList", page],
    queryFn: () => dbApi.listScoringQueue({ page, limit: 50 }),
  });

  const { mutate: approve, isPending: isApproving } = useMutation({
    mutationFn: (id) => dbApi.approveScoringQueueItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inboxItems"] });
      queryClient.invalidateQueries({ queryKey: ["scoringQueue"] });
      queryClient.invalidateQueries({ queryKey: ["scoringQueueList"] });
      toast.success("Approved — item added to inbox");
    },
    onError: (err) => toast.error(err?.response?.data?.error ?? "Failed to approve"),
  });

  const { mutate: dismiss, isPending: isDismissing } = useMutation({
    mutationFn: (id) => dbApi.dismissScoringQueueItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoringQueue"] });
      queryClient.invalidateQueries({ queryKey: ["scoringQueueList"] });
      toast.success("Dismissed");
      setPendingDismissId(null);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error ?? "Failed to dismiss");
      setPendingDismissId(null);
    },
  });

  const columns = [
    {
      accessor: "opportunity",
      header: "Title",
      render: (opp) => opp?.title ?? "—",
    },
    {
      accessor: "opportunity.type",
      header: "Type",
      render: (_, row) => row.opportunity?.type ? <span className="badge badge-info text-white">{row.opportunity.type}</span> : "—",
    },
        {
      accessor: "score",
      header: "Score",
      render: (val) => <span className="badge badge-warning font-mono">{val}</span>,
    },
    {
      accessor: "matchedSignals",
      header: "Matched Signals",
      render: (val) => <SignalPills signals={val} />,
    },
    {
      accessor: "expiresAt",
      header: "Expires",
      render: (val) => val ? new Date(val).toLocaleDateString() : "—",
    },
  
    ...(isAdmin ? [
      {
        accessor: "id",
        header: "",
        render: (id) => (
          <div className="flex gap-1">
            <button
              className="btn btn-xs btn-success"
              disabled={isApproving || isDismissing}
              onClick={(e) => { e.stopPropagation(); approve(id); }}
            >
              <CheckCircle className="size-3" /> Approve
            </button>
            <button
              className="btn btn-xs btn-error btn-outline"
              disabled={isApproving || isDismissing}
              onClick={(e) => { e.stopPropagation(); setPendingDismissId(id); }}
            >
              <XCircle className="size-3" /> Dismiss
            </button>
          </div>
        ),
      },
    ] : []),
  ];

  return (
    <>
      <Table
        columns={columns}
        data={result?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        meta={result?.meta}
        page={page}
        onPageChange={setPage}
      />
      {pendingDismissId && (
        <dialog open className="modal modal-open">
          <div className="modal-box">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => setPendingDismissId(null)}
            >✕</button>
            <h3 className="font-bold text-lg">Dismiss Opportunity</h3>
            <p className="py-4">This opportunity will be <span className="font-semibold">permanently excluded</span> from scoring and will never be re-queued, even if the filter config changes.</p>
            <div className="modal-action">
              <button className="btn btn-info text-white" onClick={() => setPendingDismissId(null)}>Cancel</button>
              <button
                className="btn btn-error text-white"
                disabled={isDismissing}
                onClick={() => dismiss(pendingDismissId)}
              >
                {isDismissing ? <span className="loading loading-spinner loading-xs" /> : "Dismiss"}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}

const InboxPage = () => {
  const [activeTab, setActiveTab] = useState("inbox");
  const [page, setPage] = usePageParam();
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
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

  const { data: scoringQueueResult } = useQuery({
    queryKey: ["scoringQueue", 1],
    queryFn: () => dbApi.listScoringQueue({ page: 1, limit: 1 }),
    enabled: isAdmin,
  });
  const pendingCount = scoringQueueResult?.meta?.total ?? 0;

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

  const { mutate: bulkDelete, isPending: isBulkDeleting } = useMutation({
    mutationFn: (ids) => dbApi.bulkDeleteInboxItems(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inboxItems"] });
      toast.success("Items deleted");
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
    },
    onError: (err) => toast.error(err?.response?.data?.error ?? "Failed to delete items"),
  });

  const columns = [
    { accessor: "title", header: "Title", render: (val) => val ?? "—" },
    { accessor: "type", header: "Type", render: (val) => val ? <span className="badge badge-info text-white">{val}</span> : "—" },
    {
      accessor: "attachmentScore",
      header: "Score",
      render: (val) => val != null ? <span className="badge badge-warning font-mono">{val}</span> : <span className="text-base-content/40">—</span>,
    },
    {
      accessor: "matchedSignals",
      header: "Matched Signals",
      render: (val) => val?.length > 0 ? <SignalPills signals={val} /> : <span className="text-base-content/40">—</span>,
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
    {
      accessor: "deadline",
      header: "Deadline",
      sortable: true,
      render: (val) => val ? new Date(val).toLocaleDateString() : "—",
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
      {/* Tab switcher */}
      <TabsJoinButton
        tabs={[
          { value: "inbox", label: "Inbox" },
          ...(isAdmin ? [{
            value: "pending",
            label: (
              <span className="flex items-center gap-1.5">
                Pending Review
                {pendingCount > 0 && <span className="badge badge-warning badge-sm">{pendingCount}</span>}
              </span>
            ),
          }] : []),
        ]}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {activeTab === "inbox" && (
        <>
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
            onDeleteSelected={() => setShowBulkDeleteConfirm(true)}
            isAdmin={isAdmin}
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
        </>
      )}

      {activeTab === "pending" && isAdmin && (
        <PendingReviewTab isAdmin={isAdmin} />
      )}

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
              <button className="btn btn-info text-white" onClick={() => setPendingDeleteId(null)}>
                Cancel
              </button>
              <button
                className="btn btn-error text-white"
                disabled={isDeleting}
                onClick={() => deleteItem(pendingDeleteId)}
              >
                {isDeleting ? <span className="loading loading-spinner loading-xs" /> : "Delete"}
              </button>
            </div>
          </div>
        </dialog>
      )}
      {showBulkDeleteConfirm && (
        <dialog open className="modal modal-open">
          <div className="modal-box">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => setShowBulkDeleteConfirm(false)}
            >✕</button>
            <h3 className="font-bold text-lg">Delete {selectedIds.size} Item{selectedIds.size !== 1 ? "s" : ""}</h3>
            <p className="py-4">Are you sure you want to delete these items? This cannot be undone.</p>
            <div className="modal-action">
              <button className="btn btn-info text-white" onClick={() => setShowBulkDeleteConfirm(false)}>Cancel</button>
              <button
                className="btn btn-error text-white"
                disabled={isBulkDeleting}
                onClick={() => bulkDelete([...selectedIds])}
              >
                {isBulkDeleting ? <span className="loading loading-spinner loading-xs" /> : "Delete"}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
};

export default InboxPage;
