import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, AlertCircle, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { adminApi } from "../lib/api.js";
import { useCurrentUser } from "../lib/CurrentUserContext.jsx";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLES = ["USER", "READ_ONLY", "ADMIN"];

const ROLE_LABELS = {
  ADMIN: "Admin",
  READ_ONLY: "Read Only",
  USER: "User",
};

const SYNC_JOBS = [
  { type: "sam-opportunities", label: "SAM Opportunities" },
  { type: "usaspending-awards", label: "USASpending Awards" },
  { type: "sam-descriptions", label: "Opportunity Descriptions" },
  { type: "sam-industry-days", label: "Industry Days" },
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

const UserManagement = () => {
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();

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

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-6 animate-spin opacity-50" />
      </div>
    );
  }

  return (
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
          {users.map((u) => {
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
                <td className="text-xs opacity-60">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sync Controls Section ────────────────────────────────────────────────────

const SyncControls = () => {
  const queryClient = useQueryClient();

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
        },
        onError: (err) => {
          toast.error(err?.response?.data?.message ?? "Sync failed");
        },
      }),
    ])
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {SYNC_JOBS.map(({ type, label }) => {
        const mutation = mutations[type];
        return (
          <button
            key={type}
            className="btn btn-outline btn-sm gap-2"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {label}
          </button>
        );
      })}
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
      {health.map(({ jobId, jobName, lastRun }) => (
        <div key={jobId} className="card card-compact bg-base-200">
          <div className="card-body gap-1">
            <p className="text-sm font-medium">{jobName}</p>
            <div className="flex items-center justify-between">
              <StatusBadge status={lastRun?.status} />
              <span className="text-xs opacity-60">{timeAgo(lastRun?.startedAt)}</span>
            </div>
            {lastRun?.recordsAffected != null && (
              <p className="text-xs opacity-60">{lastRun.recordsAffected} records</p>
            )}
            {lastRun?.errorMessage && (
              <p className="text-xs text-error truncate" title={lastRun.errorMessage}>
                {lastRun.errorMessage}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── AdminPage ────────────────────────────────────────────────────────────────

const AdminPage = () => {
  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      <h1 className="text-2xl font-bold">Admin</h1>

      {/* User Management */}
      <section className="card bg-base-100 shadow-sm border border-base-300">
        <div className="card-body gap-4">
          <h2 className="card-title text-base">User Management</h2>
          <UserManagement />
        </div>
      </section>

      {/* Manual Sync */}
      <section className="card bg-base-100 shadow-sm border border-base-300">
        <div className="card-body gap-4">
          <div>
            <h2 className="card-title text-base">Manual Sync</h2>
            <p className="text-sm opacity-60">Trigger a data sync on demand without waiting for the scheduled cron.</p>
          </div>
          <SyncControls />
        </div>
      </section>

      {/* System Health */}
      <section className="card bg-base-100 shadow-sm border border-base-300">
        <div className="card-body gap-4">
          <h2 className="card-title text-base">System Health</h2>
          <SystemHealth />
        </div>
      </section>
    </div>
  );
};

export default AdminPage;
