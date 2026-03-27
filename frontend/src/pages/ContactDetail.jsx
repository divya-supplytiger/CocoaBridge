import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, FileDown } from "lucide-react";
import toast from "react-hot-toast";
import { dbApi } from "../lib/api.js";
import { useCurrentUser } from "../lib/CurrentUserContext.jsx";
import ItemDetail from "../components/ItemDetail.jsx";
import RelatedRecordsCard from "../components/RelatedRecordsCard.jsx";
import { exportDetailToCsv, csvFilename } from "../lib/csvExport.js";

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

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["contact", id],
    queryFn: () => dbApi.getContact(id),
  });

  const item = result?.data;
  const isUnlinked = item && !item.links?.some((l) => l.opportunity);

  const [phone, setPhone] = useState(null);
  const [title, setTitle] = useState(null);

  // Initialize local state once item loads (only on first load)
  const phoneValue = phone ?? (item?.phone ?? "");
  const titleValue = title ?? (item?.title ?? "");

  const { mutate: saveContact, isPending: isSaving } = useMutation({
    mutationFn: () => dbApi.updateContact(id, { phone: phoneValue, title: titleValue }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact", id] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Saved");
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
            <div className="flex justify-end mb-2">
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
            </div>
          )}
          {isAdmin && item && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold">Edit Contact</p>
              <div className="flex flex-col gap-2">
                <label className="text-sm">Phone</label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full max-w-xs"
                  placeholder="Add phone…"
                  value={phoneValue}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm">Title</label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full max-w-xs"
                  placeholder="Add title…"
                  value={titleValue}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  className="btn btn-primary btn-sm w-fit"
                  onClick={() => saveContact()}
                  disabled={isSaving}
                >
                  {isSaving ? <span className="loading loading-spinner loading-xs" /> : "Save"}
                </button>
                {isUnlinked && (
                  <button
                    className="btn btn-error btn-sm"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </button>
                )}
              </div>
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
      </div>

      {showDeleteConfirm && (
        <dialog open className="modal modal-open">
          <div className="modal-box">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => setShowDeleteConfirm(false)}
            >✕</button>
            <h3 className="font-bold text-lg">Delete Contact</h3>
            <p className="py-4">
              Are you sure you want to delete <strong>{item?.fullName ?? "this contact"}</strong>? This cannot be undone.
            </p>
            <div className="modal-action">
              <button className="btn btn-accent" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button
                className="btn btn-error"
                disabled={isDeleting}
                onClick={() => deleteContact()}
              >
                {isDeleting ? <span className="loading loading-spinner loading-xs" /> : "Delete"}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
};

export default ContactDetail;
