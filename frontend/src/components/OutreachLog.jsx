import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { dbApi } from "../lib/api.js";
import { useCurrentUser } from "../lib/CurrentUserContext.jsx";

const OUTREACH_STATUSES = ["SENT", "RESPONDED", "NO_REPLY", "FOLLOW_UP", "MEETING_SCHEDULED", "CLOSED"];

const STATUS_BADGE = {
  SENT:              "badge-info",
  RESPONDED:         "badge-success",
  NO_REPLY:          "badge-warning",
  FOLLOW_UP:         "badge-warning",
  MEETING_SCHEDULED: "badge-success",
  CLOSED:            "badge-ghost",
};

const STATUS_LABEL = {
  SENT:              "Sent",
  RESPONDED:         "Responded",
  NO_REPLY:          "No Reply",
  FOLLOW_UP:         "Follow Up",
  MEETING_SCHEDULED: "Meeting Scheduled",
  CLOSED:            "Closed",
};

const OutreachLog = ({ contactId }) => {
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === "ADMIN";
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState("SENT");
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["contactInteractions", contactId],
    queryFn: () => dbApi.listContactInteractions(contactId),
  });

  const { mutate: createInteraction, isPending: isCreating } = useMutation({
    mutationFn: () => dbApi.createContactInteraction(contactId, { status, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contactInteractions", contactId] });
      setShowForm(false);
      setStatus("SENT");
      setNote("");
      toast.success("Interaction logged");
    },
    onError: (err) => toast.error(err?.response?.data?.error ?? "Failed to log interaction"),
  });

  const { mutate: deleteInteraction } = useMutation({
    mutationFn: (interactionId) => dbApi.deleteContactInteraction(contactId, interactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contactInteractions", contactId] });
      toast.success("Interaction deleted");
    },
    onError: (err) => toast.error(err?.response?.data?.error ?? "Failed to delete"),
  });

  const interactions = data?.data ?? [];

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300 mt-4">
      <div className="card-body gap-3">
        <div className="flex items-center justify-between">
          <h2 className="card-title text-base">Outreach Log</h2>
          {isAdmin && !showForm && (
            <button className="btn btn-sm btn-primary" onClick={() => setShowForm(true)}>
              Log Outreach
            </button>
          )}
        </div>

        {showForm && (
          <div className="flex flex-col gap-2 p-3 bg-base-200 rounded-lg">
            <div className="flex flex-col gap-1">
              <label className="text-sm">Status</label>
              <select
                className="select select-bordered select-sm w-full max-w-xs"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {OUTREACH_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm">Note <span className="opacity-40">(optional)</span></label>
              <textarea
                className="textarea textarea-bordered textarea-sm w-full"
                placeholder="Add a note…"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setNote(""); setStatus("SENT"); }}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => createInteraction()} disabled={isCreating}>
                {isCreating ? <span className="loading loading-spinner loading-xs" /> : "Save"}
              </button>
            </div>
          </div>
        )}


        {isLoading ? (
          <div className="flex justify-center py-4">
            <span className="loading loading-spinner loading-sm opacity-50" />
          </div>
        ) : interactions.length === 0 ? (
          <p className="text-sm opacity-40 py-2">No outreach logged yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {interactions.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-3 py-2 border-b border-base-200 last:border-0">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className={`badge badge-sm ${STATUS_BADGE[entry.status]}`}>
                      {STATUS_LABEL[entry.status]}
                    </span>
                    <span className="text-xs opacity-40">
                      {new Date(entry.loggedAt).toLocaleDateString()} · {entry.user?.name ?? "Unknown"}
                    </span>
                  </div>
                  {entry.note && <p className="text-sm opacity-70">{entry.note}</p>}
                </div>
                {(isAdmin || entry.user?.id === currentUser?.id) && (
                  <button
                    className="btn btn-ghost btn-xs text-error shrink-0"
                    onClick={() => deleteInteraction(entry.id)}
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OutreachLog;
