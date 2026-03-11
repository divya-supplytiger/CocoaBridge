import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Inbox } from "lucide-react";
import toast from "react-hot-toast";
import { dbApi } from "../lib/api.js";
import { useCurrentUser } from "../lib/CurrentUserContext.jsx";
import ItemDetail from "../components/ItemDetail.jsx";
import AddToInboxModal from "../components/AddToInboxModal.jsx";
import FavoriteButton from "../components/FavoriteButton.jsx";

const AwardDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === "ADMIN";
  const hasReadAccess = currentUser?.role !== "USER";
  const queryClient = useQueryClient();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddToInbox, setShowAddToInbox] = useState(false);

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["award", id],
    queryFn: () => dbApi.getAward(id),
  });

  const { data: favoritesData } = useQuery({
    queryKey: ["favorites"],
    queryFn: dbApi.listFavorites,
  });

  const item = result?.data;
  const isFavorited = (favoritesData?.awards ?? []).some((a) => a.id === id);

  const awardLink = `https://www.usaspending.gov/award/${item?.externalId}`;

  const { mutate: deleteItem, isPending: isDeleting } = useMutation({
    mutationFn: () => dbApi.deleteAward(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["award", id] });
      queryClient.invalidateQueries({ queryKey: ["awards"] });
      toast.success("Award deleted");
      navigate("/awards");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error ?? "Failed to delete award");
      setShowDeleteConfirm(false);
    },
  });

  const fields = [
    {
      label: "Award ID",
      value: item?.externalId,
      render: (val) => val ? <span className="font-mono">{val.split("_")[2]}</span> : "—",
    },
    {
      label: "Recipient",
      value: item?.recipient,
      render: (val) => val
        ? <Link to={`/recipients/${val.id}`} className="link link-primary-content">{val.name}</Link>
        : "—",
    },
    {
      label: "Agency",
      value: item?.buyingOrganization,
      render: (val) => val
        ? <Link to={`/buying-orgs/${val.id}`} className="link link-primary-content">{val.name}</Link>
        : "—",
    },
    {
      label: "Link",
      value: awardLink,
      render: (val) => val ? <Link to={val} target="_blank" rel="noopener noreferrer" className="link link-primary-content">External Link</Link> : "—",
    },
    { label: "Amount", value: item?.obligatedAmount, render: (val) => val != null ? `$${Number(val).toLocaleString()}` : "—" },
    { label: "NAICS", value: item?.naicsCodes, render: (val) => val?.length > 0 ? val.join(", ") : "—" },
    { label: "PSC", value: item?.pscCode },
    { label: "Start Date", value: item?.startDate, render: (val) => val ? new Date(val).toLocaleDateString() : "—" },
    { label: "End Date", value: item?.endDate, render: (val) => val ? new Date(val).toLocaleDateString() : "—" },
  ];

  return (
    <>
      <ItemDetail
        isLoading={isLoading}
        isError={isError}
        error={error}
        item={item}
        backTo="/awards"
        backLabel="Back to Awards"
        title={item?.description?.slice(0, 80) ?? "Award"}
        fields={fields}
      >
        {item && (
          <div className="flex justify-end gap-2">
            <FavoriteButton entityType="award" entityId={id} isFavorited={isFavorited} />
            {hasReadAccess && (
              <>
                {item.inboxItems?.length > 0 ? (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/inbox/${item.inboxItems[0].id}`)}
                  >
                    <Inbox className="size-4" />
                    View in Inbox
                  </button>
                ) : (isAdmin && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowAddToInbox(true)}
                  >
                    <Inbox className="size-4" />
                    Add to Inbox
                  </button>
                ))}
                {isAdmin && (
                  <button
                    className="btn btn-error btn-sm text-white"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </ItemDetail>

      {showDeleteConfirm && (
        <dialog open className="modal modal-open">
          <div className="modal-box">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => setShowDeleteConfirm(false)}
            >✕</button>
            <h3 className="font-bold text-lg">Delete Award</h3>
            <p className="py-4">Are you sure you want to delete this award? This cannot be undone.</p>
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
        </dialog>
      )}

      {showAddToInbox && (
        <AddToInboxModal
          awardId={id}
          defaultType="AWARD_NOTICE"
          onClose={() => setShowAddToInbox(false)}
        />
      )}
    </>
  );
};

export default AwardDetail;
