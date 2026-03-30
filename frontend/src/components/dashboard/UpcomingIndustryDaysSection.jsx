import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin } from "lucide-react";
import { dbApi } from "../../lib/api.js";
import {Link} from "react-router";
import {
  SectionShell,
  SectionLoader,
  SectionError,
  EmptyState,
  truncate,
  fmtDate,
} from "./dashboardHelpers.jsx";

const UpcomingIndustryDaysSection = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-industry-days"],
    queryFn: () => dbApi.listIndustryDays({ status: "OPEN", limit: 10 }),
  });

  const items = data?.data ?? [];

  return (
    <SectionShell
      title="Upcoming Industry Days"
      subtitle="Open industry day events ordered by event date"
    >
      {isLoading && <SectionLoader />}
      {isError && <SectionError />}
      {!isLoading && !isError && items.length === 0 && (
        <EmptyState message="No upcoming industry days." />
      )}
      {!isLoading && !isError && items.length > 0 && (
        <ul className="flex flex-col divide-y divide-base-200">
          {items.map((item) => (
            
            <li key={item.id}>
              <Link to={`/industry-day/${item.id}`} className="py-3 flex flex-col gap-1 hover:bg-base-200 rounded px-1 -mx-1 transition-colors">
                <span className="text-sm font-medium leading-snug">{truncate(item.title, 80)}</span>
                <div className="flex flex-wrap items-center gap-3 text-xs opacity-60">
                  {item.eventDate && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3" />
                      {fmtDate(item.eventDate)}
                    </span>
                  )}
                  {item.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" />
                      {item.location}
                    </span>
                  )}
                  {item.status && (
                    <span className="badge badge-xs badge-success">{item.status}</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
};

export default UpcomingIndustryDaysSection;
