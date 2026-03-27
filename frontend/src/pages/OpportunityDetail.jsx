import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Inbox, FileText, Download, ScanSearch, Eye, FileDown } from "lucide-react";
import toast from "react-hot-toast";
import { dbApi } from "../lib/api.js";
import { useCurrentUser } from "../lib/CurrentUserContext.jsx";
import ItemDetail from "../components/ItemDetail.jsx";
import RelatedRecordsCard from "../components/RelatedRecordsCard.jsx";
import AddToInboxModal from "../components/AddToInboxModal.jsx";
import FavoriteButton from "../components/FavoriteButton.jsx";
import ParsedTextModal from "../components/ParsedTextModal.jsx";
import { exportDetailToCsv, csvFilename } from "../lib/csvExport.js";

const PARSEABLE_TYPES = [".pdf", ".docx"];
const isParseable = (att) => {
  const ext = att.mimeType?.toLowerCase() || att.name?.match(/\.\w+$/)?.[0]?.toLowerCase() || "";
  return PARSEABLE_TYPES.includes(ext);
};

const OpportunityDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === "ADMIN";
  const hasReadAccess = currentUser?.role !== "USER";
  const queryClient = useQueryClient();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddToInbox, setShowAddToInbox] = useState(false);
  const [modalAttachment, setModalAttachment] = useState(null);

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["opportunity", id],
    queryFn: () => dbApi.getOpportunity(id),
  });

  const { data: favoritesData } = useQuery({
    queryKey: ["favorites"],
    queryFn: dbApi.listFavorites,
  });

  const item = result?.data;
  const isFavorited = (favoritesData?.opportunities ?? []).some((o) => o.id === id);

  const { mutate: deleteItem, isPending: isDeleting } = useMutation({
    mutationFn: () => dbApi.deleteOpportunity(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["opportunity", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success("Opportunity deleted");
      navigate("/opportunities");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error ?? "Failed to delete opportunity");
      setShowDeleteConfirm(false);
    },
  });

  const contactLinks = [];
  const seenContacts = new Set();
  for (const cl of item?.contactLinks ?? []) {
    const key = `${cl.contact.id}:${cl.type}`;
    if (seenContacts.has(key)) continue;
    seenContacts.add(key);
    contactLinks.push({ id: cl.id, to: `/contacts/${cl.contact.id}`, type: cl.type });
  }

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
          {item && (
            <div className="flex justify-end gap-2">
              <FavoriteButton entityType="opportunity" entityId={id} isFavorited={isFavorited} />
              <button
                className="btn btn-secondary btn-sm gap-1"
                onClick={() => exportDetailToCsv([
                  { label: "Title", value: item.title },
                  { label: "Solicitation Number", value: item.solicitationNumber },
                  { label: "Agency", value: item.buyingOrganization?.name },
                  { label: "Type", value: item.type },
                  { label: "Active", value: item.active ? "Yes" : "No" },
                  { label: "NAICS", value: item.naicsCodes?.join(", ") },
                  { label: "PSC", value: item.pscCode },
                  { label: "Posted", value: item.postedDate ? new Date(item.postedDate).toLocaleDateString() : "" },
                  { label: "Deadline", value: item.responseDeadline ? new Date(item.responseDeadline).toLocaleDateString() : "" },
                  { label: "Set Aside", value: item.setAside },
                  { label: "State", value: item.state },
                ], csvFilename("opportunity", id))}
              >
                <FileDown className="size-4" />
                Export
              </button>
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
                      className="btn btn-error btn-sm"
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
        {item && (
          <RelatedRecordsCard contactLinks={contactLinks} />
        )}
        {item?.attachments?.length > 0 && (
          <div className="card bg-base-100 shadow-sm mt-4">
            <div className="card-body">
              <h2 className="card-title text-base gap-2">
                <FileText className="size-5" />
                Attachments ({item.attachments.length})
              </h2>
              <p className="text-xs text-base-content/50 -mt-2">PDF and DOCX files can be parsed for content extraction</p>
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Type</th>
                      <th>Size</th>
                      <th>Posted</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.attachments.map((att) => {
                      const canParse = isParseable(att) && hasReadAccess;
                      return (
                        <tr key={att.id}>
                          <td>
                            <span className="font-mono text-sm">{att.name}</span>
                          </td>
                          <td>
                            <span className="badge badge-ghost badge-sm">
                              {att.mimeType?.replace(".", "").toUpperCase() || "—"}
                            </span>
                          </td>
                          <td className="text-sm">
                            {att.size ? (att.size < 1024 * 1024
                              ? `${(att.size / 1024).toFixed(0)} KB`
                              : `${(att.size / (1024 * 1024)).toFixed(1)} MB`
                            ) : "—"}
                          </td>
                          <td className="text-sm">
                            {att.postedDate ? new Date(att.postedDate).toLocaleDateString() : "—"}
                          </td>
                          <td>
                            {att.parsedAt ? (
                              <span className="badge badge-success badge-sm">Parsed</span>
                            ) : canParse ? (
                              <span className="badge badge-ghost badge-sm">Not parsed</span>
                            ) : (
                              <span className="text-xs text-base-content/40">—</span>
                            )}
                          </td>
                          <td className="flex gap-1 justify-end">
                            {canParse && (
                              <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => setModalAttachment(att)}
                              >
                                {att.parsedAt
                                  ? <><Eye className="size-4" /> Open</>
                                  : <><ScanSearch className="size-4" /> Parse</>}
                              </button>
                            )}
                            <a
                              href={att.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-xs"
                            >
                              <Download className="size-4" />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <dialog open className="modal modal-open">
          <div className="modal-box">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => setShowDeleteConfirm(false)}
            >✕</button>
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
        </dialog>
      )}

      {showAddToInbox && (
        <AddToInboxModal
          opportunityId={id}
          defaultType={item?.type ?? "OTHER"}
          onClose={() => setShowAddToInbox(false)}
        />
      )}

      {modalAttachment && (
        <ParsedTextModal
          attachment={modalAttachment}
          opportunityId={id}
          onClose={() => setModalAttachment(null)}
        />
      )}
    </>
  );
};

export default OpportunityDetail;
