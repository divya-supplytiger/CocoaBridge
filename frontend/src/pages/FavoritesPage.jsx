import { useMemo } from 'react';
import { useLocalStorage } from "../lib/useLocalStorage.js";
import { useQuery } from "@tanstack/react-query";
import { dbApi } from "../lib/api.js";
import Table from "../components/Table.jsx";
import FavoriteButton from "../components/FavoriteButton.jsx";
import TabsJoinButton from "../components/TabsJoinButton.jsx";

const oppColumns = (favoriteIds) => [
  {
    accessor: "id",
    header: "",
    render: (val) => (
      <FavoriteButton entityType="opportunity" entityId={val} isFavorited={favoriteIds.has(val)} />
    ),
  },
  { accessor: "title", header: "Title", sortable: true },
  { accessor: "pscCode", header: "PSC", render: (val) => val ?? "—" },
  {
    accessor: "naicsCodes",
    header: "NAICS Codes",
    render: (val) => val?.length > 0 ? val.join(", ") : "—",
  },
  {
    accessor: "responseDeadline",
    header: "Deadline",
    render: (val) => val ? new Date(val).toLocaleDateString() : "—",
  },
  {
    accessor: "type",
    header: "Type",
    render: (val) => val ? <span className="badge badge-info text-white">{val}</span> : "—",
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

const awardColumns = (favoriteIds) => [
  {
    accessor: "id",
    header: "",
    render: (val) => (
      <FavoriteButton entityType="award" entityId={val} isFavorited={favoriteIds.has(val)} />
    ),
  },
  {
    accessor: "description",
    header: "Description",
    render: (val) => val && val.length > 60 ? `${val.slice(0, 60)}…` : (val ?? "—"),
  },
  {
    accessor: "obligatedAmount",
    header: "Amount",
    render: (val) => val ? `$${Number(val).toLocaleString()}` : "—",
  },
  { accessor: "pscCode", header: "PSC", render: (val) => val ?? "—" },
  {
    accessor: "naicsCodes",
    header: "NAICS Codes",
    render: (val) => val?.length > 0 ? val.join(", ") : "—",
  },
  {
    accessor: "startDate",
    header: "Start",
    render: (val) => val ? new Date(val).toLocaleDateString() : "—",
  },
  {
    accessor: "endDate",
    header: "End",
    render: (val) => val ? new Date(val).toLocaleDateString() : "—",
  },
];

const FavoritesPage = () => {
  const tabs = [
    { label: "Opportunities", value: "opportunities" },
    { label: "Awards", value: "awards" },
  ];
  const [activeTab, setActiveTab] = useLocalStorage("st:tab:favorites", tabs[0].value);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["favorites"],
    queryFn: dbApi.listFavorites,
  });

  const opportunities = useMemo(() => data?.opportunities ?? [], [data]);
  const awards = useMemo(() => data?.awards ?? [], [data]);

  const oppFavoriteIds = useMemo(() => new Set(opportunities.map((o) => o.id)), [opportunities]);
  const awardFavoriteIds = useMemo(() => new Set(awards.map((a) => a.id)), [awards]);

  return (
    <div className="flex flex-col gap-4">
      <TabsJoinButton tabs={tabs} activeTab={activeTab} setActiveTab={handleTabChange} />

      {activeTab === "opportunities" ? (
        <Table
          columns={oppColumns(oppFavoriteIds)}
          data={opportunities}
          isLoading={isLoading}
          isError={isError}
          error={error}
          basePath="/opportunities"
          emptyMessage="No favorited opportunities"
          emptySubMessage="Star an opportunity to save it here."
        />
      ) : (
        <Table
          columns={awardColumns(awardFavoriteIds)}
          data={awards}
          isLoading={isLoading}
          isError={isError}
          error={error}
          basePath="/awards"
          emptyMessage="No favorited awards"
          emptySubMessage="Star an award to save it here."
        />
      )}
    </div>
  );
};

export default FavoritesPage;
