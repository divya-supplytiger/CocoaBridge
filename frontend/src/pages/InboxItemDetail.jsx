import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Trophy, Handshake } from "lucide-react";
import toast from "react-hot-toast";
import { dbApi } from "../lib/api.js";
import { useCurrentUser } from "../lib/CurrentUserContext.jsx";
import ItemDetail from "../components/ItemDetail.jsx";

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
  const queryClient = useQueryClient();

  const [notes, setNotes] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["inboxItem", id],
    queryFn: () => dbApi.getInboxItem(id),
  });

  const item = result?.data;
  const notesValue = notes ?? (item?.notes ?? "");

  const { mutate: updateItem, isPending: isUpdating } = useMutation({
    mutationFn: (body) => dbApi.updateInboxItem(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inboxItem", id] });
      queryClient.invalidateQueries({ queryKey: ["inboxItems"] });
      toast.success("Saved");
    },
    onError: (err) => toast.error(err?.response?.data?.error ?? "Failed to save"),
  });

  const { mutate: deleteItem, isPending: isDeleting } = useMutation({
    mutationFn: () => dbApi.deleteInboxItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inboxItems"] });
      toast.success("Item deleted");
      navigate("/inbox");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error ?? "Failed to delete item");
      setShowDeleteConfirm(false);
    },
  });

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
        {isAdmin && item && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Status</span>
                <select
                  className="select select-sm select-bordered"
                  value={item.reviewStatus}
                  disabled={isUpdating}
                  onChange={(e) => updateItem({ reviewStatus: e.target.value })}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 ml-auto">
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
                <button
                  className="btn btn-error btn-sm"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="size-4" />
                  Delete
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <p className="font-semibold text-sm">Notes</p>
              <textarea
                className="textarea textarea-bordered text-sm w-full"
                rows={6}
                value={notesValue}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes…"
              />
              <button
                className="btn btn-sm btn-primary self-end"
                disabled={isUpdating}
                onClick={() => updateItem({ notes: notesValue })}
              >
                {isUpdating ? <span className="loading loading-spinner loading-xs" /> : "Save Notes"}
              </button>
            </div>
          </div>
        )}

        {!isAdmin && item?.notes && (
          <div>
            <p className="font-semibold text-sm">Notes</p>
            <p className="text-sm text-base-content/80">{item.notes}</p>
          </div>
        )}
      </ItemDetail>

      {showDeleteConfirm && (
        <dialog open className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Delete Inbox Item</h3>
            <p className="py-4">Are you sure you want to delete this inbox item? This cannot be undone.</p>
            <div className="modal-action">
              <button className="btn btn-accent" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button
                className="btn btn-error"
                disabled={isDeleting}
                onClick={() => deleteItem()}
              >
                {isDeleting ? <span className="loading loading-spinner loading-xs" /> : "Delete"}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button className="btn btn-accent" onClick={() => setShowDeleteConfirm(false)}>close</button>
          </form>
        </dialog>
      )}
    </>
  );
};

export default InboxItemDetail;
