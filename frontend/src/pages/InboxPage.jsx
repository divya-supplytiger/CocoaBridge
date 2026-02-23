import { useState } from 'react'
import { useQuery } from "@tanstack/react-query";
import { dbApi } from "../lib/api.js";
import Table from "../components/Table.jsx";

const STATUS_BADGE = {
  NEW: "badge-neutral",
  IN_REVIEW: "badge-warning",
  QUALIFIED: "badge-success",
  DISMISSED: "badge-error",
  CONTACTED: "badge-info",
  CLOSED: "badge-ghost",
};

const columns = [
  { accessor: "title", header: "Title", render: (val) => val ?? "—" },
  { accessor: "type", header: "Type" },
  {
    accessor: "reviewStatus",
    header: "Status",
    render: (val) => (
      <span className={`badge ${STATUS_BADGE[val] ?? "badge-neutral"}`}>{val}</span>
    ),
  },
  { accessor: "acquisitionPath", header: "Path" },
  {
    accessor: "createdAt",
    header: "Created",
    render: (val) => new Date(val).toLocaleDateString(),
  },
];

const InboxPage = () => {
  const [page, setPage] = useState(1);

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["inboxItems", page],
    queryFn: () => dbApi.listInboxItems({ page, limit: 50 }),
  });

  return (
    <div>
      <Table
        columns={columns}
        data={result?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        meta={result?.meta}
        page={page}
        onPageChange={setPage}
        basePath="/inbox"
      />
    </div>
  );
};

export default InboxPage;