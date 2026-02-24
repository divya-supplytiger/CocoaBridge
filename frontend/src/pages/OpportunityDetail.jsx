import { useParams } from 'react-router';
import { useQuery } from "@tanstack/react-query";
import { dbApi } from "../lib/api.js";
import ItemDetail from "../components/ItemDetail.jsx";
import RelatedRecordsCard from "../components/RelatedRecordsCard.jsx";

const OpportunityDetail = () => {
  const { id } = useParams();

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["opportunity", id],
    queryFn: () => dbApi.getOpportunity(id),
  });

  const item = result?.data;

  const contactLinks = item?.contactLinks?.map((cl) => ({
    id: cl.id,
    to: `/contacts/${cl.contact.id}`,
    type: cl.type,
  })) ?? [];

  const badges = (
    <>
      {item?.type && <span className="badge badge-info badge-outline">{item.type}</span>}
      <span className={`badge badge-outline ${item?.active ? "badge-success" : "badge-error"}`}>
        {item?.active ? "Active" : "Inactive"}
      </span>
      {item?.setAside && <span className="badge badge-warning badge-outline">{item.setAside}</span>}
    </>
  );

  const fields = [
    { label: "Agency", value: item?.buyingOrganization?.name },
    { label: "NAICS", value: item?.naicsCodes, render: (val) => val?.length > 0 ? val.join(", ") : "—" },
    { label: "PSC", value: item?.pscCode },
    { label: "Posted", value: item?.postedDate, render: (val) => val ? new Date(val).toLocaleDateString() : "—" },
    { label: "Deadline", value: item?.responseDeadline, render: (val) => val ? new Date(val).toLocaleDateString() : "—" },
    { label: "Set Aside", value: item?.setAside },
  ];

  return (
    <div>
      <ItemDetail
        isLoading={isLoading}
        isError={isError}
        error={error}
        item={item}
        backTo="/opportunities"
        backLabel="Back to Opportunities"
        title={item?.title ?? "Untitled"}
        badges={badges}
        description={item?.description}
        fields={fields}
      />
      {item && (
        <RelatedRecordsCard contactLinks={contactLinks} />
      )}
    </div>
  );
};

export default OpportunityDetail;
