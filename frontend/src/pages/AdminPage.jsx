import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, AlertCircle, CheckCircle, X, Clock, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { adminApi } from "../lib/api.js";
import { useCurrentUser } from "../lib/CurrentUserContext.jsx";
import TabsJoinButton from "../components/TabsJoinButton.jsx";
import PaginationButton from "../components/PaginationButton.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import { COMPANY_PROFILE_DEFAULT } from "../lib/companyProfile.js";
import { PairsListEditor, ChipListEditor } from "../components/ListEditors.jsx";

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Testing
const ROLES = ["USER", "READ_ONLY", "ADMIN"];

const ROLE_LABELS = {
  ADMIN: "Admin",
  READ_ONLY: "Read Only",
  USER: "User",
};

const SYNC_JOBS = [
  { type: "sam-opportunities", label: "SAM Opportunities", description: "Pull current active opportunities from SAM.gov and upsert into the database." },
  { type: "usaspending-awards", label: "USASpending Awards", description: "Sync recent federal contract awards from USASpending.gov across all configured presets." },
  { type: "sam-descriptions", label: "Opportunity Descriptions", description: "Backfill missing descriptions for opportunities that were synced without full text." },
  { type: "sam-industry-days", label: "Industry Days", description: "Sync industry day and outreach events from SAM.gov." },
  { type: "sam-attachments", label: "Attachment Metadata", description: "Fetch file metadata (name, size, type) for opportunity attachments from the SAM.gov resources endpoint." },
  { type: "score-opportunity-attachments", label: "Score New Opportunities", description: "Run FLIS-based scoring on unprocessed PSC/NAICS-matched opportunities. High scores are auto-admitted to inbox; mid-range scores go to the review queue." },
  { type: "score-attachments", label: "Score Parsed Attachments", description: "Run MCP scoring on attachments that have parsed text but no score result yet. Writes score to the attachment record." },
  { type: "backfill-inbox-scores", label: "Backfill Inbox Scores", description: "Re-score inbox items that have parsed attachment text but no attachment score. One-time catch-up for items created before the scoring pipeline was live." },
  { type: "backfill-award-inbox-scores", label: "Backfill Award Inbox Scores", description: "Score award-linked inbox items that have no score yet. Uses NAICS/PSC/keyword/micropurchase signals. Does not delete items below threshold." },
  { type: "cleanup-chats", label: "Cleanup Expired Chats", description: "Delete chat conversations that have passed their retention expiry date." },
  { type: "send-daily-digest", label: "Send Daily Digest", description: "Send today's digest email immediately to all active users with digest enabled. Use for testing." },
  { type: "cleanup-db", label: "Cleanup Expired Parsed Docs", description: "Clear stored parsed text from attachments on inactive opportunities older than 21 days. Frees database storage without deleting opportunity or inbox item records.", requiresConfirm: true },
];

const ADMIN_TABS = [
  { value: "users", label: "Users" },
  { value: "access", label: "Access" },
  { value: "sync", label: "Sync" },
  { value: "health", label: "Health" },
  { value: "filters", label: "Filters" },
  { value: "parsedDocs", label: "Parsed Docs" },
  { value: "companyProfile", label: "Company Profile" },
];

const timeAgo = (dateStr) => {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const StatusBadge = ({ status }) => {
  if (!status) return <span className="badge badge-ghost badge-sm">Never run</span>;
  if (status === "PARTIAL") return <span className="badge badge-warning badge-sm gap-1"><AlertCircle className="size-3" />Partial</span>;
  if (status === "SUCCESS") return <span className="badge badge-success badge-sm gap-1"><CheckCircle className="size-3" />Success</span>;
  if (status === "FAILED") return <span className="badge badge-error badge-sm gap-1"><XCircle className="size-3" />Failed</span>;
  return <span className="badge badge-warning badge-sm gap-1"><Clock className="size-3" />Running</span>;
}

// ─── User Management Section ─────────────────────────────────────────────────

const PAGE_SIZE = 10;

const UserManagement = () => {
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["adminUsers"],
    queryFn: adminApi.listUsers,
  });

  const { mutate: updateUser } = useMutation({
    mutationFn: ({ id, body }) => adminApi.updateUser(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      toast.success("User updated");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message ?? "Failed to update user");
    },
  });

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const paginated = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-6 animate-spin opacity-50" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Active</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
                <tr key={u.id} className={isSelf ? "opacity-50" : ""}>
                  <td>
                    <div className="flex items-center gap-2">
                      {u.imageUrl ? (
                        <img src={u.imageUrl} alt={u.name} className="w-8 h-8 rounded-full shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-base-300 shrink-0" />
                      )}
                      <span className="font-medium text-sm">{u.name ?? "—"}</span>
                      {isSelf && <span className="badge badge-ghost badge-xs">you</span>}
                    </div>
                  </td>
                  <td className="text-sm opacity-70">{u.email}</td>
                  <td>
                    <select
                      className="select select-xs select-bordered"
                      value={u.role}
                      disabled={isSelf}
                      onChange={(e) => updateUser({ id: u.id, body: { role: e.target.value } })}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      className="toggle toggle-sm toggle-success"
                      checked={u.isActive}
                      disabled={isSelf}
                      onChange={(e) => updateUser({ id: u.id, body: { isActive: e.target.checked } })}
                    />
                  </td>
                  <td className="text-sm opacity-60">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <PaginationButton
          totalPages={totalPages}
          currentPage={page}
          onPageChange={setPage}
          size="sm"
          justify="center"
        />
      )}
    </div>
  );
}

// ─── Sync Controls Section ────────────────────────────────────────────────────

const SyncControls = () => {
  const queryClient = useQueryClient();
  const [confirmJob, setConfirmJob] = useState(null); // { type, label, preview: { opportunityCount, attachmentCount } }
  const [previewLoading, setPreviewLoading] = useState(false);

  const mutations = Object.fromEntries(
    SYNC_JOBS.map(({ type }) => [
      type,
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useMutation({
        mutationFn: () => adminApi.triggerSync(type),
        onSuccess: (data) => {
          const count = data?.recordsAffected;
          toast.success(
            count != null
              ? `${data.jobName}: ${count} records affected`
              : `${data.jobName} completed`
          );
          queryClient.invalidateQueries({ queryKey: ["systemHealth"] });
          queryClient.invalidateQueries({ queryKey: ["parsedDocuments"] });
          queryClient.invalidateQueries({ queryKey: ["parsedDocumentStats"] });
        },
        onError: (err) => {
          toast.error(err?.response?.data?.message ?? "Sync failed");
        },
      }),
    ])
  );

  const handleConfirmJobClick = async (type, label) => {
    setPreviewLoading(true);
    try {
      const preview = await adminApi.cleanupDbPreview();
      setConfirmJob({ type, label, preview });
    } catch {
      toast.error("Failed to fetch preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-sm opacity-60">
        <p className="font-medium opacity-80">Recommended run order for a full sync:</p>
        <ol className="list-decimal list-inside flex flex-col gap-0.5">
          <li>SAM Opportunities — pull current opp records first</li>
          <li>Opportunity Descriptions — backfill missing descriptions</li>
          <li>Industry Days — sync events linked to opportunities</li>
          <li>Attachment Metadata — fetch file metadata for resource links</li>
          <li>Score New Opportunities — parse + score unprocessed opps</li>
          <li>USASpending Awards — independent; run any time</li>
          <li>Backfill Award Inbox Scores — score award-linked inbox items</li>
        </ol>
        <p className="mt-1">Cleanup and backfill jobs can run at any time.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {SYNC_JOBS.map(({ type, label, description, requiresConfirm }) => {
        const mutation = mutations[type];
        const isThisPreviewLoading = previewLoading && requiresConfirm;
        return (
          <div key={type} className="flex flex-col gap-1.5 p-3 rounded-lg bg-accent-content/10">
            <button
              className="btn btn-sm gap-2 bg-accent-content/10 hover:bg-accent-content/20 border-0 text-accent-content text-md self-start"
              onClick={() => requiresConfirm ? handleConfirmJobClick(type, label) : mutation.mutate()}
              disabled={mutation.isPending || isThisPreviewLoading}
            >
              {(mutation.isPending || isThisPreviewLoading) ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {label}
            </button>
            {description && <p className="text-sm opacity-50 leading-snug">{description}</p>}
          </div>
        );
      })}
      </div>

      <ConfirmModal
        open={!!confirmJob}
        onClose={() => setConfirmJob(null)}
        isPending={confirmJob ? mutations[confirmJob.type]?.isPending : false}
        onConfirm={() => {
          if (!confirmJob) return;
          mutations[confirmJob.type].mutate();
          setConfirmJob(null);
        }}
        title={confirmJob?.label ?? ""}
        confirmLabel="Clear"
      >
        {confirmJob?.preview && (
          <>
            This will clear parsed text from{" "}
            <strong>{confirmJob.preview.attachmentCount} attachment(s)</strong> across{" "}
            <strong>{confirmJob.preview.opportunityCount} opportunity record(s)</strong>.
            {" "}Opportunity records, inbox items, and notes will not be deleted.
            This cannot be undone.
          </>
        )}
      </ConfirmModal>
    </div>
  );
}

// ─── System Health Section ────────────────────────────────────────────────────

const SystemHealth = () => {
  const { data: health = [], isLoading } = useQuery({
    queryKey: ["systemHealth"],
    queryFn: adminApi.getSystemHealth,
    refetchInterval: 30000, // refresh every 30s
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-6 animate-spin opacity-50" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {health.map(({ jobId, jobName, lastRun, history = [] }) => (
        <JobHealthCard key={jobId} jobName={jobName} lastRun={lastRun} history={history} />
      ))}
    </div>
  );
}

const JobHealthCard = ({ jobName, lastRun, history }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="card card-compact bg-accent-content/10">
      <div className="card-body gap-1">
        <p className="text-sm font-medium">{jobName}</p>
        <div className="flex items-center justify-between">
          <StatusBadge status={lastRun?.status} />
          <span className="text-sm opacity-60">{timeAgo(lastRun?.startedAt)}</span>
        </div>
        {lastRun?.recordsAffected != null && (
          <p className="text-sm opacity-60">{lastRun.recordsAffected} records</p>
        )}
        {lastRun?.errorMessage && (
          <p className="text-sm text-error truncate" title={lastRun.errorMessage}>
            {lastRun.errorMessage}
          </p>
        )}
        {history.length > 1 && (
          <div>
            <button
              type="button"
              className="flex items-center gap-1 text-sm opacity-50 hover:opacity-80 mt-1"
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              History ({history.length})
            </button>
            {open && (
              <div className="flex flex-col gap-1 mt-1">
                {history.slice(1).map((run) => (
                  <div key={run.id} className="flex items-center justify-between text-sm opacity-60">
                    <StatusBadge status={run.status} />
                    <span>{timeAgo(run.startedAt)}</span>
                    {run.recordsAffected != null && <span>{run.recordsAffected} rec</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DB Stats Section ─────────────────────────────────────────────────────────

const DbStats = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dbStats"],
    queryFn: adminApi.getDbStats,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin opacity-50" /></div>;
  }

  const inboxTotal = Object.values(stats?.inbox ?? {}).reduce((s, n) => s + n, 0);

  const tiles = [
    { label: "Active Opps", value: stats?.opportunities?.active ?? 0 },
    { label: "Inactive Opps", value: stats?.opportunities?.inactive ?? 0 },
    { label: "Awards", value: stats?.awards ?? 0 },
    { label: "Contacts", value: stats?.contacts ?? 0 },
    { label: "Inbox Items", value: inboxTotal },
    { label: "Chat Conversations", value: stats?.chatConversations ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {tiles.map(({ label, value }) => (
          <div key={label} className="card card-compact bg-accent-content/10">
            <div className="card-body items-center text-center gap-0">
              <p className="text-lg font-semibold">{value.toLocaleString()}</p>
              <p className="text-sm opacity-60">{label}</p>
            </div>
          </div>
        ))}
      </div>
      {stats?.inbox && Object.keys(stats.inbox).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(stats.inbox).map(([status, count]) => (
            <span key={status} className="badge badge-sm badge-ghost gap-1">
              {status.replace("_", " ")}: {count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Filter Configuration Section ────────────────────────────────────────────

const FILTER_SECTIONS = [
  { label: "Solicitation Keywords", activeKey: "solicitationKeywords", bankKey: "solicitationKeywordsBank" },
  { label: "NAICS Codes", activeKey: "naicsCodes", bankKey: "naicsCodesBank" },
  { label: "PSC Prefixes", activeKey: "pscPrefixes", bankKey: "pscPrefixesBank" },
  { label: "Industry Day Keywords", activeKey: "industryDayKeywords", bankKey: "industryDayKeywordsBank" },
];

const FilterListEditor = ({ sectionLabel, activeKey, bankKey, config, hideBank = false, placeholder }) => {
  const queryClient = useQueryClient();
  const [activeInput, setActiveInput] = useState("");
  const [bankInput, setBankInput] = useState("");
  const [bankOpen, setBankOpen] = useState(false);

  const activeValues = config[activeKey] ?? [];
  const bankValues = config[bankKey] ?? [];

  const { mutate: saveActive, isPending: savingActive } = useMutation({
    mutationFn: (values) => adminApi.updateFilterConfig(activeKey, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["filterConfig"] });
      toast.success(`${sectionLabel} saved`);
    },
    onError: () => toast.error(`Failed to save ${sectionLabel}`),
  });

  const { mutate: saveBank } = useMutation({
    mutationFn: (values) => adminApi.updateFilterConfig(bankKey, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["filterConfig"] });
      toast.success("Word bank updated");
    },
    onError: () => toast.error("Failed to update word bank"),
  });

  const addToActive = (value) => {
    const v = value.trim();
    if (!v || activeValues.includes(v)) return;
    saveActive([...activeValues, v]);
  };

  const removeFromActive = (value) => {
    saveActive(activeValues.filter((v) => v !== value));
  };

  const addToBank = (value) => {
    const v = value.trim();
    if (!v || bankValues.includes(v)) return;
    saveBank([...bankValues, v]);
  };

  const removeFromBank = (value) => {
    saveBank(bankValues.filter((v) => v !== value));
  };

  const moveChipToActive = (value) => {
    if (!activeValues.includes(value)) {
      saveActive([...activeValues, value]);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Active list */}
      <div className="flex flex-wrap gap-1.5 min-h-8">
        {activeValues.map((v) => (
          <span key={v} className="badge badge-accent text-white gap-1">
            {v}
            <button
              type="button"
              className="hover:opacity-70"
              onClick={() => removeFromActive(v)}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {activeValues.length === 0 && (
          <span className="text-sm opacity-40 italic">No active values — sync runs without this filter</span>
        )}
      </div>

      {/* Add input */}
      <div className="flex gap-2">
        <input
          type="text"
          className="input input-sm input-bordered flex-1 max-w-xs"
          placeholder={placeholder ?? `Add ${sectionLabel.toLowerCase()}…`}
          value={activeInput}
          onChange={(e) => setActiveInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              addToActive(activeInput);
              setActiveInput("");
            }
          }}
        />
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={savingActive || !activeInput.trim()}
          onClick={() => { addToActive(activeInput); setActiveInput(""); }}
        >
          {savingActive ? <Loader2 className="size-3 animate-spin" /> : "Add"}
        </button>
      </div>

      {/* Word bank */}
      {!hideBank && (
        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-sm opacity-60 hover:opacity-90"
            onClick={() => setBankOpen((o) => !o)}
          >
            {bankOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            Word bank ({bankValues.length})
          </button>
          {bankOpen && (
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5">
                {bankValues.map((v) => (
                  <span key={v} className="badge badge-secondary text-white gap-1 cursor-pointer hover:badge-primary" onClick={() => moveChipToActive(v)}>
                    {v}
                    <button
                      type="button"
                      className="hover:opacity-70"
                      onClick={(e) => { e.stopPropagation(); removeFromBank(v); }}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                {bankValues.length === 0 && (
                  <span className="text-sm opacity-40 italic">Bank is empty</span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input input-sm input-bordered flex-1 max-w-xs"
                  placeholder="Add to bank…"
                  value={bankInput}
                  onChange={(e) => setBankInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addToBank(bankInput);
                      setBankInput("");
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-ghost border border-base-300"
                  disabled={!bankInput.trim()}
                  onClick={() => { addToBank(bankInput); setBankInput(""); }}
                >
                  Add to bank
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const FilterConfig = () => {
  const [activeSection, setActiveSection] = useState(FILTER_SECTIONS[0].activeKey);

  const { data: config, isLoading } = useQuery({
    queryKey: ["filterConfig"],
    queryFn: adminApi.getFilterConfig,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-6 animate-spin opacity-50" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="join flex-wrap">
        {FILTER_SECTIONS.map(({ label, activeKey }) => (
          <button
            key={activeKey}
            className={`join-item btn btn-sm ${activeSection === activeKey ? "btn-primary" : "btn-ghost hover:bg-accent-content/40 border border-accent-content/40"}`}
            onClick={() => setActiveSection(activeKey)}
          >
            {label}
          </button>
        ))}
      </div>
      {FILTER_SECTIONS.map(({ label, activeKey, bankKey }) => (
        <div key={activeKey} className={activeSection === activeKey ? "" : "hidden"}>
          <FilterListEditor
            sectionLabel={label}
            activeKey={activeKey}
            bankKey={bankKey}
            config={config}
          />
        </div>
      ))}
    </div>
  );
};

// ─── Access Control Section ───────────────────────────────────────────────────

const RetentionEditor = ({ initialDays }) => {
  const queryClient = useQueryClient();
  const [days, setDays] = useState(initialDays);

  useEffect(() => {
    setDays(initialDays);
  }, [initialDays]);

  const { mutate: saveRetention, isPending: savingRetention } = useMutation({
    mutationFn: (value) => adminApi.updateFilterConfig("chatRetentionDays", [String(value)]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["filterConfig"] });
      toast.success("Chat retention updated");
    },
    onError: () => toast.error("Failed to update chat retention"),
  });

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Chat retention (days)</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={365}
          className="input input-sm input-bordered w-24"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        />
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={savingRetention}
          onClick={() => saveRetention(days)}
        >
          {savingRetention ? <Loader2 className="size-3 animate-spin" /> : "Save"}
        </button>
      </div>
      <p className="text-sm opacity-50">Changes apply to new conversations only</p>
    </div>
  );
};

const AccessControl = () => {
  const { data: config, isLoading } = useQuery({
    queryKey: ["filterConfig"],
    queryFn: adminApi.getFilterConfig,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-6 animate-spin opacity-50" />
      </div>
    );
  }

  const configDays = parseInt(config?.chatRetentionDays?.[0], 10);
  const initialDays = isNaN(configDays) ? 14 : configDays;

  return (
    <div className="flex flex-col gap-6">
      {/* Email Rules */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Admin Email Rules</p>
          <FilterListEditor
            sectionLabel="Admin Email Rules"
            activeKey="adminEmailRules"
            bankKey=""
            config={config ?? {}}
            hideBank={true}
            placeholder="Add email or @domain.com…"
          />
          <p className="text-sm opacity-50">Use exact email (user@example.com) or domain postfix (@example.com)</p>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Read-Only Email Rules</p>
          <FilterListEditor
            sectionLabel="Read-Only Email Rules"
            activeKey="readOnlyEmailRules"
            bankKey=""
            config={config ?? {}}
            hideBank={true}
            placeholder="Add email or @domain.com…"
          />
          <p className="text-sm opacity-50">Use exact email (user@example.com) or domain postfix (@example.com)</p>
        </div>
      </div>

      <div className="divider my-0" />

      {/* Chat Retention */}
      <RetentionEditor initialDays={initialDays} />
    </div>
  );
};

// ─── Parsed Documents Panel ──────────────────────────────────────────────────

const PARSED_DOC_FILTER_TABS = [
  { value: "all", label: "All" },
  { value: "unparsed", label: "Unparsed" },
  { value: "unscored", label: "Unscored" },
  { value: "parsed", label: "Parsed" },
  { value: "scored", label: "Scored" },
];

const formatSize = (bytes) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const ParsedDocumentsPanel = () => {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data: stats } = useQuery({
    queryKey: ["parsedDocumentStats"],
    queryFn: adminApi.getParsedDocumentStats,
    refetchInterval: 60000,
  });

  const { data: resources, isLoading } = useQuery({
    queryKey: ["parsedDocuments", filter, page],
    queryFn: () => adminApi.listParsedDocuments({ filter, page, limit: 25 }),
  });

  const statTiles = stats
    ? [
        { label: "Total", value: stats.total },
        { label: "Parsed", value: stats.parsed },
        { label: "Unparsed", value: stats.unparsed },
        { label: "Scored", value: stats.scored },
        { label: "Unscored", value: stats.unscored },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      {statTiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {statTiles.map(({ label, value }) => (
            <div key={label} className="card card-compact bg-accent-content/10">
              <div className="card-body items-center text-center gap-0">
                <p className="text-lg font-semibold">{value.toLocaleString()}</p>
                <p className="text-sm opacity-60">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="join flex-wrap">
        {PARSED_DOC_FILTER_TABS.map(({ value, label }) => (
          <button
            key={value}
            className={`join-item btn btn-sm ${filter === value ? "btn-primary" : "btn-ghost hover:bg-accent-content/40 border border-accent-content/40"}`}
            onClick={() => { setFilter(value); setPage(1); }}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin opacity-50" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Opportunity</th>
                  <th>Size</th>
                  <th>Parsed</th>
                  <th>Scored</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {resources?.items?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center opacity-50 py-4">No resources</td>
                  </tr>
                )}
                {resources?.items?.map((r) => (
                  <tr key={r.id}>
                    <td className="max-w-xs text-sm font-medium">
                      <span className="truncate block max-w-[16rem]" title={r.name}>{r.name}</span>
                    </td>
                    <td className="text-sm opacity-70">
                      <span className="truncate block max-w-[14rem]" title={r.opportunity?.title ?? undefined}>
                        {r.opportunity?.solicitationNumber ?? r.opportunity?.title ?? "—"}
                      </span>
                    </td>
                    <td className="text-sm opacity-60 whitespace-nowrap">{formatSize(r.size)}</td>
                    <td>
                      {r.parsedAt ? (
                        <span className="badge badge-success badge-sm gap-1">
                          <CheckCircle className="size-3" />{timeAgo(r.parsedAt)}
                        </span>
                      ) : (
                        <span className="badge badge-ghost badge-sm">Not parsed</span>
                      )}
                    </td>
                    <td>
                      {r.scoredAt ? (
                        <span className="badge badge-success badge-sm gap-1">
                          <CheckCircle className="size-3" />{timeAgo(r.scoredAt)}
                        </span>
                      ) : (
                        <span className="badge badge-ghost badge-sm">Not scored</span>
                      )}
                    </td>
                    <td className="text-sm opacity-60 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {resources?.totalPages > 1 && (
            <PaginationButton
              totalPages={resources.totalPages}
              currentPage={page}
              onPageChange={setPage}
              size="sm"
              justify="center"
            />
          )}
        </div>
      )}
    </div>
  );
};

// ─── Company Profile Editor ───────────────────────────────────────────────────

const SectionHeading = ({ children }) => (
  <p className="text-sm font-semibold opacity-70 uppercase tracking-wide mt-2">{children}</p>
);

const CompanyProfileEditor = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["companyProfile"],
    queryFn: adminApi.getCompanyProfile,
  });

  // Initialize form from query data once it arrives (render-time update per React's
  // "storing information from previous renders" pattern — avoids effect cascading).
  if (data != null && form === null) setForm(data);

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => adminApi.updateCompanyProfile(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyProfile"] });
      toast.success("Company profile saved");
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Failed to save profile"),
  });

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const setContact = (field, value) => setForm((f) => ({ ...f, contact: { ...f.contact, [field]: value } }));

  if (isLoading || !form) {
    return <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin opacity-50" /></div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading>Identity</SectionHeading>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: "Legal Name", field: "legalName" },
          { label: "DBA", field: "dba" },
          { label: "UEI", field: "uei", mono: true, maxLength: 12 },
          { label: "CAGE Code", field: "cageCode", mono: true, maxLength: 5 },
          { label: "SAM Status", field: "samStatus" },
          { label: "GSA Schedule", field: "gsaSchedule" },
          { label: "Business Type", field: "businessType" },
        ].map(({ label, field, mono, maxLength }) => (
          <div key={field} className="flex flex-col gap-1">
            <label className="text-sm opacity-60">{label}</label>
            <input
              type="text"
              className={`input input-sm input-bordered${mono ? " font-mono" : ""}`}
              value={form[field] ?? ""}
              maxLength={maxLength}
              onChange={(e) => set(field, e.target.value)}
            />
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <label className="text-sm opacity-60">Established</label>
          <input
            type="number"
            className="input input-sm input-bordered w-28"
            min={1900}
            max={new Date().getFullYear()}
            value={form.established ?? ""}
            onChange={(e) => set("established", parseInt(e.target.value, 10) || "")}
          />
        </div>
      </div>

      <SectionHeading>NAICS Codes</SectionHeading>
      <PairsListEditor label="NAICS" value={form.naicsCodes} onChange={(v) => set("naicsCodes", v)} />

      <SectionHeading>PSC Codes</SectionHeading>
      <PairsListEditor label="PSC" value={form.pscCodes} onChange={(v) => set("pscCodes", v)} />

      <SectionHeading>Acquisition Paths</SectionHeading>
      <ChipListEditor value={form.acquisitionPaths} onChange={(v) => set("acquisitionPaths", v)} placeholder="e.g. GSA" />

      <SectionHeading>Core Competencies</SectionHeading>
      <ChipListEditor value={form.coreCompetencies} onChange={(v) => set("coreCompetencies", v)} placeholder="Add competency…" />

      <SectionHeading>Contact</SectionHeading>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: "Name", field: "name" },
          { label: "Phone", field: "phone" },
          { label: "Email", field: "email" },
          { label: "Website", field: "website" },
          { label: "Address", field: "address" },
        ].map(({ label, field }) => (
          <div key={field} className="flex flex-col gap-1">
            <label className="text-sm opacity-60">{label}</label>
            <input
              type="text"
              className="input input-sm input-bordered"
              value={form.contact?.[field] ?? ""}
              onChange={(e) => setContact(field, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button type="button" className="btn btn-sm btn-info text-white" onClick={() => setResetOpen(true)}>
          Reset to Defaults
        </button>
        <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => save()}>
          {saving ? <Loader2 className="size-3 animate-spin" /> : "Save"}
        </button>
      </div>

      <ConfirmModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => { setForm(COMPANY_PROFILE_DEFAULT); setResetOpen(false); }}
        title="Reset to Defaults"
        confirmLabel="Reset"
        variant="error"
      >
        This will restore all fields to the hardcoded default values. You still need to click Save to persist the change.
      </ConfirmModal>
    </div>
  );
};

// ─── AdminPage ────────────────────────────────────────────────────────────────

const TAB_CONTENT = {
  users: { title: "User Management" },
  access: { title: "Access Control", description: "Configure default roles for new users at sign-up and set the chat conversation retention window." },
  sync: { title: "Manual Sync", description: "Trigger a data sync on demand without waiting for the scheduled cron." },
  health: { title: "Health" },
  filters: { title: "Filter Configuration", description: "Manage the keywords and codes used to filter SAM.gov and USASpending syncs. Changes take effect on the next sync run." },
  parsedDocs: { title: "Parsed Documents", description: "Attachment files collected from SAM.gov opportunities — view parse and score status across all records." },
  companyProfile: { title: "Company Profile", description: "Manage SupplyTiger's registered identity, codes, and contact information used by the AI assistant." },
};

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState("users");
  const { title, description } = TAB_CONTENT[activeTab];

  return (
    <div className="flex flex-col gap-4">
      <TabsJoinButton tabs={ADMIN_TABS} activeTab={activeTab} setActiveTab={setActiveTab} />

      <section className="card bg-base-100 shadow-sm border border-base-300">
        <div className="card-body gap-4">
          <div>
            <h2 className="card-title text-base text-md">{title}</h2>
            {description && <p className="text-sm opacity-60">{description}</p>}
          </div>

          {activeTab === "users" && <UserManagement />}
          {activeTab === "access" && <AccessControl />}
          {activeTab === "sync" && <SyncControls />}
          {activeTab === "health" && (
            <div className="flex flex-col gap-6">
              <DbStats />
              <div className="divider my-0" />
              <SystemHealth />
            </div>
          )}
          {activeTab === "filters" && <FilterConfig />}
          {activeTab === "parsedDocs" && <ParsedDocumentsPanel />}
          {activeTab === "companyProfile" && <CompanyProfileEditor />}
        </div>
      </section>
    </div>
  );
};

export default AdminPage;
