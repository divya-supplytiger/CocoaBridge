import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, FileDown } from "lucide-react";
import toast from "react-hot-toast";
import { dbApi } from "../lib/api.js";
import { useCurrentUser } from "../lib/CurrentUserContext.jsx";
import ItemDetail from "../components/ItemDetail.jsx";
import RelatedRecordsCard from "../components/RelatedRecordsCard.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import { exportDetailToCsv, csvFilename } from "../lib/csvExport.js";
import OutreachLog from "../components/OutreachLog.jsx";

// Deduplicate ContactLink rows by the linked entity's own id.
// The same entity can appear multiple times (once per contact role —
// PRIMARY, SECONDARY, etc.), so we keep only the first occurrence.
const uniqueById = (arr) => {
  const seen = new Set();
  return arr.filter(({ id }) => seen.has(id) ? false : seen.add(id));
};

const ContactDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === "ADMIN";
  const queryClient = useQueryClient();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({});

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["contact", id],
    queryFn: () => dbApi.getContact(id),
  });

  const item = result?.data;
  const isUnlinked = item && !item.links?.some((l) => l.opportunity);

  const { mutate: saveContact, isPending: isSaving } = useMutation({
    mutationFn: () => dbApi.updateContact(id, { phone: draft.phone, title: draft.title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact", id] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Saved");
      setIsEditing(false);
      setDraft({});
    },
    onError: (err) => toast.error(err?.response?.data?.error ?? "Failed to save"),
  });

  const { mutate: deleteContact, isPending: isDeleting } = useMutation({
    mutationFn: () => dbApi.deleteContact(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["contact", id] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact deleted");
      navigate("/contacts");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error ?? "Failed to delete contact");
      setShowDeleteConfirm(false);
    },
  });

  const handleEdit = () => {
    setDraft({ phone: item.phone ?? "", title: item.title ?? "" });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraft({});
    setIsEditing(false);
  };

  const opportunityLinks = uniqueById(
    item?.links
      ?.filter((l) => l.opportunity)
      .map((l) => ({ id: l.opportunity.id, to: `/opportunities/${l.opportunity.id}`, label: l.opportunity.title ?? "Untitled Opportunity" })) ?? []
  );

  const industryDayLinks = uniqueById(
    item?.links
      ?.filter((l) => l.industryDay)
      .map((l) => ({ id: l.industryDay.id, to: `/industry-days/${l.industryDay.id}`, label: l.industryDay.title ?? "Untitled Industry Day" })) ?? []
  );

  const buyingOrgLinks = uniqueById(
    item?.links
      ?.filter((l) => l.buyingOrganization)
      .map((l) => ({ id: l.buyingOrganization.id, to: `/buying-orgs/${l.buyingOrganization.id}`, label: l.buyingOrganization.name })) ?? []
  );

  const badges = isUnlinked ? (
    <span className="badge badge-warning text-white">Unlinked</span>
  ) : null;

  const fields = [
    { label: "Email", value: item?.email },
    {
      label: "Phone",
      value: item?.phone
        ? <a href={`tel:${item.phone}`} className="link link-primary">{item.phone}</a>
        : null,
    },
    { label: "Title", value: item?.title },
  ];

  return (
    <>
      <div>
        <ItemDetail
          isLoading={isLoading}
          isError={isError}
          error={error}
          item={item}
          backTo="/contacts"
          backLabel="Back to Contacts"
          title={item?.fullName ?? "Contact"}
          badges={badges}
          fields={fields}
        >
          {item && (
            <div className="flex flex-col gap-3">
              {isEditing ? (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm">Phone</label>
                    <input
                      type="text"
                      className="input input-bordered input-sm w-full max-w-xs"
                      placeholder="Add phone…"
                      value={draft.phone}
                      onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm">Title</label>
                    <input
                      type="text"
                      className="input input-bordered input-sm w-full max-w-xs"
                      placeholder="Add title…"
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      className="btn btn-secondary btn-sm gap-1"
                      onClick={() => exportDetailToCsv([
                        { label: "Name", value: item.fullName },
                        { label: "Email", value: item.email },
                        { label: "Phone", value: item.phone },
                        { label: "Title", value: item.title },
                        { label: "Buying Agency", value: item.links?.[0]?.buyingOrganization?.name },
                      ], csvFilename("contact", id))}
                    >
                      <FileDown className="size-4" />
                      Export
                    </button>
                    {isAdmin && isUnlinked && (
                      <button
                        className="btn btn-error btn-sm"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={handleCancel}>Cancel</button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => saveContact()}
                      disabled={isSaving}
                    >
                      {isSaving ? <span className="loading loading-spinner loading-xs" /> : "Save"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex justify-end gap-2">
                  <button
                    className="btn btn-secondary btn-sm gap-1"
                    onClick={() => exportDetailToCsv([
                      { label: "Name", value: item.fullName },
                      { label: "Email", value: item.email },
                      { label: "Phone", value: item.phone },
                      { label: "Title", value: item.title },
                      { label: "Buying Agency", value: item.links?.[0]?.buyingOrganization?.name },
                    ], csvFilename("contact", id))}
                  >
                    <FileDown className="size-4" />
                    Export
                  </button>
                  {isAdmin && isUnlinked && (
                    <button
                      className="btn btn-error btn-sm"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </button>
                  )}
                  {isAdmin && (
                    <button className="btn btn-success text-white btn-sm" onClick={handleEdit}>Edit</button>
                  )}
                </div>
              )}
            </div>
          )}
        </ItemDetail>
        {item && (
          <RelatedRecordsCard
            opportunityLinks={opportunityLinks}
            industryDayLinks={industryDayLinks}
            buyingOrgLinks={buyingOrgLinks}
          />
        )}
        {item && <OutreachLog contactId={id} />}
      </div>

      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteContact()}
        title="Delete Contact"
        confirmLabel="Delete"
        isPending={isDeleting}
      >
        Are you sure you want to delete <strong>{item?.fullName ?? "this contact"}</strong>? This cannot be undone.
      </ConfirmModal>
    </>
  );
};

export default ContactDetail;
