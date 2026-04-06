import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Trophy, Handshake, FileDown } from "lucide-react";
import toast from "react-hot-toast";
import { dbApi } from "../lib/api.js";
import { useCurrentUser } from "../lib/CurrentUserContext.jsx";
import ItemDetail from "../components/ItemDetail.jsx";
import SignalPills from "../components/SignalPills.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import { exportDetailToCsv, csvFilename } from "../lib/csvExport.js";
import NoteLog from "../components/NoteLog.jsx";

const STATUS_BADGE = {
  NEW: "badge-neutral",
  IN_REVIEW: "badge-warning",
  QUALIFIED: "badge-success",
  DISMISSED: "badge-error",
  CONTACTED: "badge-info",
  CLOSED: "badge-ghost",
};

const STATUSES = ["NEW", "IN_REVIEW", "QUALIFIED", "DISMISSED", "CONTACTED", "CLOSED"];

const InboxItemDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === "ADMIN";
  const hasReadAccess = currentUser?.role !== "USER";
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["inboxItem", id],
    queryFn: () => dbApi.getInboxItem(id),
  });

  const item = result?.data;

  const { mutate: updateItem, isPending: isUpdating } = useMutation({
    mutationFn: (body) => dbApi.updateInboxItem(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inboxItem", id] });
      queryClient.invalidateQueries({ queryKey: ["inboxItems"] });
      toast.success("Saved");
      setIsEditing(false);
      setDraft({});
    },
    onError: (err) => toast.error(err?.response?.data?.error ?? "Failed to save"),
  });

  const { mutate: deleteItem, isPending: isDeleting } = useMutation({
    mutationFn: () => dbApi.deleteInboxItem(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["inboxItem", id] });
      queryClient.invalidateQueries({ queryKey: ["inboxItems"] });
      toast.success("Item deleted");
      navigate("/inbox");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error ?? "Failed to delete item");
      setShowDeleteConfirm(false);
    },
  });

  const handleEdit = () => {
    const deadlineSource = item.deadline ?? item.opportunity?.responseDeadline ?? null;
    setDraft({
      reviewStatus: item.reviewStatus,
      title: item.title ?? "",
      deadline: deadlineSource ? new Date(deadlineSource).toISOString().slice(0, 10) : "",
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraft({});
    setIsEditing(false);
  };

  const handleSave = () => {
    updateItem({
      reviewStatus: draft.reviewStatus,
      title: draft.title,
      deadline: draft.deadline ? new Date(draft.deadline).toISOString() : null,
    });
  };

  const badges = (
    <>
      <span className={`badge ${STATUS_BADGE[item?.reviewStatus] ?? "badge-neutral"}`}>{item?.reviewStatus}</span>
      <span className="badge">{item?.type}</span>
      <span className="badge">{item?.acquisitionPath}</span>
    </>
  );

  const fields = [
    { label: "Source", value: item?.source },
    { label: "Tag", value: item?.tag },
    { label: "Reviewed By", value: item?.reviewedBy },
    { label: "Reviewed At", value: item?.reviewedAt, render: (val) => val ? new Date(val).toLocaleString() : "—" },
    { label: "Created", value: item?.createdAt, render: (val) => val ? new Date(val).toLocaleString() : "—" },
    { label: "Deadline", value: item?.deadline, render: (val) => val ? new Date(val).toLocaleDateString() : "—" },
    ...(item?.attachmentScore != null ? [
      { label: "Attachment Score", value: item.attachmentScore, render: (val) => <span className="badge badge-warning font-mono">{val}</span> },
    ] : []),
  ];

  return (
    <>
      <ItemDetail
        isLoading={isLoading}
        isError={isError}
        error={error}
        item={item}
        backTo="/inbox"
        backLabel="Back to Inbox"
        title={item?.title ?? "Untitled"}
        badges={badges}
        fields={fields}
      >
        {hasReadAccess && item && (
          <div className="flex flex-col gap-3">
                       
           

            {item.matchedSignals?.length > 0 && (
              <div>
                <p className="font-semibold text-sm mb-1">Matched Signals</p>
                <SignalPills signals={item.matchedSignals} />
              </div>
            )}

             <div className="flex gap-2 ml-auto flex-wrap">
              <button
                className="btn btn-secondary btn-sm gap-1"
                onClick={() => exportDetailToCsv([
                  { label: "Title", value: item.title },
                  { label: "Type", value: item.type },
                  { label: "Review Status", value: item.reviewStatus },
                  { label: "Acquisition Path", value: item.acquisitionPath },
                  { label: "Source", value: item.source },
                  { label: "Tag", value: item.tag },
                  { label: "Reviewed By", value: item.reviewedBy },
                  { label: "Created", value: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "" },
                ], csvFilename("inbox-item", id))}
              >
                <FileDown className="size-4" />
                Export
              </button>

              {item.opportunity && (
                <Link to={`/opportunities/${item.opportunity.id}`} className="btn btn-primary btn-sm">
                  <Handshake className="size-4" />
                  View Opportunity
                </Link>
              )}
              {item.award && (
                <Link to={`/awards/${item.award.id}`} className="btn btn-primary btn-sm">
                  <Trophy className="size-4" />
                  View Award
                </Link>
              )}
            </div>

                 <div className="flex gap-2 ml-auto flex-wrap">
                              {isAdmin && (
                <button
                  className="btn btn-error text-white btn-sm"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="size-4" />
                  Delete
                </button>
              )}
              {isAdmin && !isEditing && (
                <button className="btn btn-success text-white btn-sm" onClick={handleEdit}>Edit</button>
              )}
                  </div>

            {isAdmin && isEditing && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Status</span>
                  <select
                    className="select select-sm select-bordered"
                    value={draft.reviewStatus}
                    disabled={isUpdating}
                    onChange={(e) => setDraft({ ...draft, reviewStatus: e.target.value })}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Title</label>
                  <input
                    className="input input-sm input-bordered w-full"
                    value={draft.title}
                    disabled={isUpdating}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="Title…"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Deadline</label>
                  <input
                    type="date"
                    className="input input-sm input-bordered"
                    value={draft.deadline}
                    disabled={isUpdating}
                    onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button className="btn btn-ghost btn-sm" onClick={handleCancel}>Cancel</button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={isUpdating}
                    onClick={handleSave}
                  >
                    {isUpdating ? <span className="loading loading-spinner loading-xs" /> : "Save"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </ItemDetail>

      {item && (
        <NoteLog
          title="Notes"
          queryKey={["inboxItemNotes", id]}
          fetchFn={() => dbApi.listInboxItemNotes(id)}
          createFn={(text) => dbApi.createInboxItemNote(id, text)}
          deleteFn={(noteId) => dbApi.deleteInboxItemNote(id, noteId)}
          canAdd={isAdmin}
          canDelete={() => isAdmin}
        />
      )}

      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteItem()}
        title="Delete Inbox Item"
        confirmLabel="Delete"
        isPending={isDeleting}
      >
        Are you sure you want to delete this inbox item? This cannot be undone.
      </ConfirmModal>
    </>
  );
};

export default InboxItemDetail;
