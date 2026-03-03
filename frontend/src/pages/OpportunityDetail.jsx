import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Inbox } from "lucide-react";
import toast from "react-hot-toast";
import { dbApi } from "../lib/api.js";
import { useCurrentUser } from "../lib/CurrentUserContext.jsx";
import ItemDetail from "../components/ItemDetail.jsx";
import RelatedRecordsCard from "../components/RelatedRecordsCard.jsx";
import AddToInboxModal from "../components/AddToInboxModal.jsx";

const OpportunityDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === "ADMIN";
  const queryClient = useQueryClient();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddToInbox, setShowAddToInbox] = useState(false);

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["opportunity", id],
    queryFn: () => dbApi.getOpportunity(id),
  });

  const item = result?.data;

  const { mutate: deleteItem, isPending: isDeleting } = useMutation({
    mutationFn: () => dbApi.deleteOpportunity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success("Opportunity deleted");
      navigate("/opportunities");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error ?? "Failed to delete opportunity");
      setShowDeleteConfirm(false);
    },
  });

  const contactLinks = item?.contactLinks?.map((cl) => ({
    id: cl.id,
    to: `/contacts/${cl.contact.id}`,
    type: cl.type,
  })) ?? [];

  const opportunityLink = `https://sam.gov/workspace/contract/opp/${item?.noticeId}/view`;

  const badges = (
    <>
      {item?.type && <span className="badge badge-info">{item.type}</span>}
      <span className={`badge ${item?.active ? "badge-success" : "badge-error"}`}>
        {item?.active ? "Active" : "Inactive"}
      </span>
      {item?.setAside && <span className="badge badge-warning">{item.setAside}</span>}
    </>
  );

  const fields = [
    { label: "Solicitation Number", value: item?.solicitationNumber, render: (val) => val ? <span className="font-mono">{val}</span> : "—" },
    { label: "Agency", value: <Link to={`/buying-orgs/${item?.buyingOrganization?.id}`} className="link link-primary-content">{item?.buyingOrganization?.name}</Link> },
    { label: "Link", value: opportunityLink, render: (val) => val ? <a href={val} target="_blank" rel="noopener noreferrer" className="link link-primary-content">External Link</a> : "—" },
    { label: "NAICS", value: item?.naicsCodes, render: (val) => val?.length > 0 ? val.join(", ") : "—" },
    { label: "PSC", value: item?.pscCode },
    { label: "Posted", value: item?.postedDate, render: (val) => val ? new Date(val).toLocaleDateString() : "—" },
    { label: "Deadline", value: item?.responseDeadline, render: (val) => val ? new Date(val).toLocaleDateString() : "—" },
    { label: "Set Aside", value: item?.setAside },
  ];

  return (
    <>
      <div>
        <ItemDetail
          isLoading={isLoading}
          isError={isError}
          error={error}
          item={item}
          backTo="/opportunities"
          backLabel="Back to Opportunities"
          title={item?.title ?? "Untitled"}
          badges={badges}
          description={item?.description}
          fields={fields}
        >
          {isAdmin && item && (
            <div className="flex justify-end gap-2">
              {item.inboxItems?.length > 0 ? (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate(`/inbox/${item.inboxItems[0].id}`)}
                >
                  <Inbox className="size-4" />
                  View in Inbox
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowAddToInbox(true)}
                >
                  <Inbox className="size-4" />
                  Add to Inbox
                </button>
              )}
              <button
                className="btn btn-error btn-sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="size-4" />
                Delete
              </button>
            </div>
          )}
        </ItemDetail>
        {item && (
          <RelatedRecordsCard contactLinks={contactLinks} />
        )}
      </div>

      {showDeleteConfirm && (
        <dialog open className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Delete Opportunity</h3>
            <p className="py-4">Are you sure you want to delete this opportunity? This cannot be undone.</p>
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

      {showAddToInbox && (
        <AddToInboxModal
          opportunityId={id}
          defaultType={item?.type ?? "OTHER"}
          onClose={() => setShowAddToInbox(false)}
        />
      )}
    </>
  );
};

export default OpportunityDetail;
