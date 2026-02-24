import { useState } from 'react'
import { useQuery } from "@tanstack/react-query";
import { dbApi } from "../lib/api.js";
import Table from "../components/Table.jsx";

// TODO: Link to recipient and agency pages when those are implemented

const columns = [
  { accessor: "title", header: "Title" },
  {
    accessor: "pscCode",
    header: "PSC",
    render: (val) => val ?? "—",
  },
  {
    accessor: "naicsCodes",
    header: "NAICS Codes",
    render: (val) => val?.length > 0 ? val.join(", ") : "—",
  },
    {
    accessor: "responseDeadline",
    header: "Deadline",
    render: (val) => (val ? new Date(val).toLocaleDateString() : "—"),
  },
  {
    accessor: "setAside",
    header: "Set Aside",
    render: (val) => val ? <span className="badge badge-warning text-white">{val}</span> : "—",
  },
    {
    accessor: "type",
    header: "Type",
    render: (val) => val ? <span className="badge badge-info text-white">{val}</span> : "—",
  },

  {
    accessor: "state",
    header: "State",
    render: (val) => val ? <span className="badge badge-primary text-white">{val}</span> : "—",
  },
  {
    accessor: "active",
    header: "Status",
    render: (val) => (
      <span className={`badge ${val ? "badge-success" : "badge-error"} text-white`}>
        {val ? "Active" : "Inactive"}
      </span>
    ),
  },
];

const Opportunities = () => {
  const [page, setPage] = useState(1);

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["opportunities", page],
    queryFn: () => dbApi.listOpportunities({ page, limit: 50 }),
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
        basePath="/opportunities"
      />
    </div>
  );
};

export default Opportunities;
