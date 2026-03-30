import { useState } from "react";
import { useParams, Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import toast from "react-hot-toast";
import { dbApi } from "../lib/api.js";
import { useCurrentUser } from "../lib/CurrentUserContext.jsx";
import ItemDetail from "../components/ItemDetail.jsx";
import { exportDetailToCsv, csvFilename } from "../lib/csvExport.js";

const STATUS_BADGE = {
  OPEN: "badge-info",
  NOT_ATTENDING: "badge-warning",
  ATTENDING: "badge-success",
  ATTENDED: "badge-neutral",
  PAST_EVENT: "badge-ghost",
};

const STATUSES = ["OPEN", "NOT_ATTENDING", "ATTENDING", "ATTENDED", "PAST_EVENT"];

const IndustryDayDetail = () => {
  const { id } = useParams();
  const currentUser = useCurrentUser();

  const isAdmin = currentUser?.role === "ADMIN";
  const hasReadAccess = currentUser?.role !== "USER";
  const queryClient = useQueryClient();

  const [summary, setSummary] = useState(null);

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["industryDay", id],
    queryFn: () => dbApi.getIndustryDay(id),
  });

  const item = result?.data;
  const summaryValue = summary ?? (item?.summary ?? "");

  const { mutate: updateItem, isPending: isUpdating } = useMutation({
    mutationFn: (body) => dbApi.updateIndustryDay(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["industryDay", id] });
      queryClient.invalidateQueries({ queryKey: ["industryDays"] });
      toast.success("Saved");
    },
    onError: (err) => toast.error(err?.response?.data?.error ?? "Failed to save"),
  });

  const badges = (
    <>
      <span className={`badge ${STATUS_BADGE[item?.status] ?? "badge-neutral"}`}>{item?.status}</span>
      <span className="badge">{item?.source}</span>
    </>
  );

  const fields = [
    { label: "Event Date", value: item?.eventDate, render: (val) => val ? new Date(val).toLocaleDateString() : "—" },
    { label: "Location", value: item?.location },
    { label: "Host", value: item?.host },
    { label: "Buying Organization", value: item?.buyingOrganization?.name },
    { label: "Created", value: item?.createdAt, render: (val) => val ? new Date(val).toLocaleString() : "—" },
  ];

  return (
    <ItemDetail
      isLoading={isLoading}
      isError={isError}
      error={error}
      item={item}
      backTo="/industry-day"
      backLabel="Back to Industry Days"
      title={item?.title ?? "Untitled"}
      badges={badges}
      fields={fields}
    >
      {hasReadAccess && item && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {isAdmin && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Status</span>
                <select
                  className="select select-sm select-bordered"
                  value={item.status}
                  disabled={isUpdating}
                  onChange={(e) => updateItem({ status: e.target.value })}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                className="btn btn-secondary btn-sm gap-1"
                onClick={() => exportDetailToCsv([
                  { label: "Title", value: item.title },
                  { label: "Status", value: item.status },
                  { label: "Source", value: item.source },
                  { label: "Event Date", value: item.eventDate ? new Date(item.eventDate).toLocaleDateString() : "" },
                  { label: "Location", value: item.location },
                  { label: "Host", value: item.host },
                  { label: "Buying Organization", value: item.buyingOrganization?.name },
                ], csvFilename("industry-day", id))}
              >
                <FileDown className="size-4" />
                Export
              </button>
              {item.opportunity && (
                <Link to={`/opportunities/${item.opportunity.id}`} className="btn btn-primary btn-sm">
                  View Opportunity
                </Link>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="flex flex-col gap-2">
              <p className="font-semibold text-sm">Summary</p>
              <textarea
                className="textarea textarea-bordered text-sm w-full"
                rows={6}
                value={summaryValue}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Add summary…"
              />
              <button
                className="btn btn-sm btn-primary self-end"
                disabled={isUpdating}
                onClick={() => updateItem({ summary: summaryValue })}
              >
                {isUpdating ? <span className="loading loading-spinner loading-xs" /> : "Save Summary"}
              </button>
            </div>
          )}

          {!isAdmin && item.summary && (
            <div>
              <p className="font-semibold text-sm">Summary</p>
              <p className="text-sm text-base-content/80">{item.summary}</p>
            </div>
          )}
        </div>
      )}
    </ItemDetail>
  );
};

export default IndustryDayDetail;
