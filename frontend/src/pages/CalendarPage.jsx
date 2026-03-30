import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useLocalStorage } from "../lib/useLocalStorage.js";
import { usePageParam } from "../lib/usePageParam.js";
import { dbApi } from "../lib/api.js";
import { useCurrentUser } from "../lib/CurrentUserContext.jsx";
import Table from "../components/Table.jsx";
import TabsJoinButton from "../components/TabsJoinButton.jsx";
import MonthGrid from "../components/calendar/MonthGrid.jsx";

const INDUSTRY_DAY_STATUSES = ["OPEN", "NOT_ATTENDING", "ATTENDING", "ATTENDED", "PAST_EVENT"];

const STATUS_BADGE = {
  OPEN: "badge-info",
  NOT_ATTENDING: "badge-neutral",
  ATTENDING: "badge-success",
  ATTENDED: "badge-ghost",
  PAST_EVENT: "badge-ghost",
};

const TYPE_FILTERS = [
  { label: "All", value: "all" },
  { label: "Deadlines", value: "deadline" },
  { label: "Industry Days", value: "industry_day" },
];

const CalendarPage = () => {
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === "ADMIN";
  const queryClient = useQueryClient();

  const tabs = [
    { label: "Industry Days", value: "industry-days" },
    { label: "Calendar", value: "calendar" },
  ];
  const [activeTab, setActiveTab] = useLocalStorage("st:tab:calendar", tabs[0].value);

  // Industry Days tab state
  const [page, setPage] = usePageParam();
  const [statusFilter, setStatusFilter] = useState("");

  // Calendar tab state
  const today = new Date();
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-11
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [typeFilter, setTypeFilter] = useState("all");

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ id, status }) => dbApi.updateIndustryDay(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["industryDays"] });
      toast.success("Status updated");
    },
    onError: (err) => toast.error(err?.response?.data?.error ?? "Failed to update status"),
  });

  const industryDayColumns = [
    { accessor: "title", header: "Title", render: (val) => val ?? "—" },
    {
      accessor: "eventDate",
      header: "Event Date",
      render: (val) => val ? new Date(val).toLocaleDateString() : "—",
    },
    { accessor: "location", header: "Location", render: (val) => val ?? "—" },
    { accessor: "host", header: "Host", render: (val) => val ?? "—" },
    {
      accessor: "status",
      header: "Status",
      render: (val, row) => isAdmin ? (
        <select
          className="select select-xs select-bordered"
          value={val}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); updateStatus({ id: row.id, status: e.target.value }); }}
        >
          {INDUSTRY_DAY_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      ) : (
        <span className={`badge ${STATUS_BADGE[val] ?? "badge-neutral"} badge-sm`}>{val}</span>
      ),
    },
  ];

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  };

  const { data: industryResult, isLoading: industryLoading, isError: industryError, error: industryErr } = useQuery({
    queryKey: ["industryDays", page, statusFilter],
    queryFn: () => dbApi.listIndustryDays({ page, limit: 50, ...(statusFilter && { status: statusFilter }) }),
    enabled: activeTab === "industry-days",
  });

  const { data: calendarResult, isLoading: calLoading } = useQuery({
    queryKey: ["calendarEvents", calMonth + 1, calYear],
    queryFn: () => dbApi.listCalendarEvents({ month: calMonth + 1, year: calYear }),
    enabled: activeTab === "calendar",
  });

  const allEvents = calendarResult?.data ?? [];
  const filteredEvents = typeFilter === "all"
    ? allEvents
    : allEvents.filter((e) => e.type === typeFilter);

  return (
    <div className="flex flex-col gap-4">
      <TabsJoinButton tabs={tabs} activeTab={activeTab} setActiveTab={handleTabChange} />

      {activeTab === "industry-days" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <select
              className="select select-bordered select-sm"
              value={statusFilter}
              onChange={handleStatusChange}
            >
              <option value="">All Statuses</option>
              {INDUSTRY_DAY_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <Table
            columns={industryDayColumns}
            data={industryResult?.data ?? []}
            isLoading={industryLoading}
            isError={industryError}
            error={industryErr}
            meta={industryResult?.meta}
            page={page}
            onPageChange={setPage}
            basePath="/industry-days"
            emptyMessage="No Industry Days"
            emptySubMessage="Industry days will appear here once available."
          />
        </div>
      )}

      {activeTab === "calendar" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                className={`btn btn-sm ${typeFilter === f.value ? "btn-primary" : "btn-base-300"}`}
                onClick={() => setTypeFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <MonthGrid
            events={filteredEvents}
            month={calMonth}
            year={calYear}
            onPrev={prevMonth}
            onNext={nextMonth}
            isLoading={calLoading}
          />
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
