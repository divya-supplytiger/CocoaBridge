import { useNavigate } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function eventBadgeClass(event) {
  if (event.type === "industry_day") return "badge badge-primary badge-sm";
  const daysAway = Math.ceil((new Date(event.date) - new Date()) / (1000 * 60 * 60 * 24));
  return daysAway <= 3 ? "badge badge-error badge-sm" : "badge badge-warning badge-sm";
}

function eventPath(event) {
  return event.type === "deadline"
    ? `/opportunities/${event.relatedId}`
    : `/industry-days/${event.relatedId}`;
}

const MonthGrid = ({ events = [], month, year, onPrev, onNext, isLoading }) => {
  const navigate = useNavigate();

  const today = new Date();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build a map of day → events
  const eventsByDay = {};
  for (const event of events) {
    const d = new Date(event.date).getDate();
    if (!eventsByDay[d]) eventsByDay[d] = [];
    eventsByDay[d].push(event);
  }

  // Grid cells: leading empty cells + day cells
  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="flex flex-col gap-3 bg-base-100 rounded-lg p-2 h-full shadow">
      {/* Month nav header */}
      <div className="flex items-center justify-between">
        <button className="btn btn-ghost btn-sm" onClick={onPrev}>
          <ChevronLeft className="size-5" />
        </button>
        <span className="font-semibold text-lg">{MONTH_NAMES[month]} {year}</span>
        <button className="btn btn-ghost btn-sm" onClick={onNext}>
          <ChevronRight className="size-5" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : (
        <div className="grid grid-cols-7 border-base-300 h-full">
          {/* Day of week headers */}
          {DAY_HEADERS.map((h) => (
            <div key={h} className="border border-secondary/20 px-2 py-1 text-xs font-semibold text-base-content/60 text-center bg-secondary/20">
              {h}
            </div>
          ))}

          {/* Day cells */}
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="border border-base-300 bg-base-200/40 min-h-24 rounded" />;
            }

            const isToday =
              today.getFullYear() === year &&
              today.getMonth() === month &&
              today.getDate() === day;

            const dayEvents = eventsByDay[day] ?? [];

            return (
              <div
                key={day}
                className={`border border-base-300 min-h-24 p-1 rounded flex flex-col gap-1 ${isToday ? "bg-primary/10 border-primary/80" : ""}`}
              >
                <span className={`text-xs font-semibold self-end px-1 rounded ${isToday ? "bg-primary text-primary-content" : "text-base-content/70"}`}>
                  {day}
                </span>
                <div className="flex flex-col gap-0.5 overflow-y-auto max-h-20">
                  {dayEvents.map((event) => (
                    <button
                      key={event.id}
                      className={`${eventBadgeClass(event)} block text-left truncate overflow-hidden max-w-full cursor-pointer`}
                      title={event.title}
                      onClick={() => navigate(eventPath(event))}
                    >
                      {event.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MonthGrid;
