import { useParams } from 'react-router';
import { useQuery } from "@tanstack/react-query";
import { Link } from 'react-router';
import { dbApi } from "../lib/api.js";
import ItemDetail from "../components/ItemDetail.jsx";

const AwardDetail = () => {
  const { id } = useParams();

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["award", id],
    queryFn: () => dbApi.getAward(id),
  });

  const item = result?.data;

  const fields = [
    {
      label: "Recipient",
      value: item?.recipient,
      render: (val) => val
        ? <Link to={`/recipients/${val.id}`} className="link link-primary">{val.name}</Link>
        : "—",
    },
    {
      label: "Agency",
      value: item?.buyingOrganization,
      render: (val) => val
        ? <Link to={`/buying-orgs/${val.id}`} className="link link-primary">{val.name}</Link>
        : "—",
    },
    { label: "Amount", value: item?.obligatedAmount, render: (val) => val != null ? `$${Number(val).toLocaleString()}` : "—" },
    { label: "NAICS", value: item?.naicsCodes, render: (val) => val?.length > 0 ? val.join(", ") : "—" },
    { label: "PSC", value: item?.pscCode },
    { label: "Start Date", value: item?.startDate, render: (val) => val ? new Date(val).toLocaleDateString() : "—" },
    { label: "End Date", value: item?.endDate, render: (val) => val ? new Date(val).toLocaleDateString() : "—" },
  ];

  return (
    <ItemDetail
      isLoading={isLoading}
      isError={isError}
      error={error}
      item={item}
      backTo="/awards"
      backLabel="Back to Awards"
      title={item?.description?.slice(0, 80) ?? "Award"}
      fields={fields}
    />
  );
};

export default AwardDetail;
