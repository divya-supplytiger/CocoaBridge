import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { dbApi } from "../lib/api.js";

const SOURCES = ["SAM", "USASPENDING", "MANUAL"];
const ACQ_PATHS = ["MICROPURCHASE", "GSA", "OPEN_MARKET", "SUBCONTRACTING"];
const ITEM_TYPES = ["PRE_SOLICITATION", "AWARD_NOTICE", "SOURCES_SOUGHT", "SPECIAL_NOTICE", "SOLICITATION", "OTHER"];
const TAGS = ["INDUSTRY_DAY", "GENERAL"];

const AddToInboxModal = ({ opportunityId, awardId, defaultType = "", onClose }) => {
  const navigate = useNavigate();
  const [inboxForm, setInboxForm] = useState({
    source: "MANUAL",
    acquisitionPath: "",
    type: defaultType,
    tag: "GENERAL",
  });

  const { mutate: addToInbox, isPending: isAddingToInbox } = useMutation({
    mutationFn: () => dbApi.createInboxItem({
      ...inboxForm,
      ...(opportunityId ? { opportunityId } : {}),
      ...(awardId ? { awardId } : {}),
    }),
    onSuccess: (res) => {
      toast.success("Added to Inbox");
      navigate(`/inbox/${res.data.id}`);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error ?? "Failed to add to inbox");
    },
  });

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box flex flex-col gap-4">
        <h3 className="font-bold text-lg">Add to Inbox</h3>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 w-full">
            <span className="text-sm font-medium">Source</span>
            <select
              className="select select-bordered select-sm w-full"
              value={inboxForm.source}
              onChange={(e) => setInboxForm((f) => ({ ...f, source: e.target.value }))}
            >
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 w-full">
            <span className="text-sm font-medium">Acquisition Path</span>
            <select
              className="select select-bordered select-sm w-full"
              value={inboxForm.acquisitionPath}
              onChange={(e) => setInboxForm((f) => ({ ...f, acquisitionPath: e.target.value }))}
            >
              <option value="">Select…</option>
              {ACQ_PATHS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 w-full">
            <span className="text-sm font-medium">Type</span>
            <select
              className="select select-bordered select-sm w-full"
              value={inboxForm.type}
              onChange={(e) => setInboxForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="">Select…</option>
              {ITEM_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 w-full">
            <span className="text-sm font-medium">Tag</span>
            <select
              className="select select-bordered select-sm w-full"
              value={inboxForm.tag}
              onChange={(e) => setInboxForm((f) => ({ ...f, tag: e.target.value }))}
            >
              {TAGS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <div className="modal-action">
          <button className="btn btn-accent" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={isAddingToInbox || !inboxForm.acquisitionPath || !inboxForm.type}
            onClick={() => addToInbox()}
          >
            {isAddingToInbox ? <span className="loading loading-spinner loading-xs" /> : "Add to Inbox"}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
};

export default AddToInboxModal;
