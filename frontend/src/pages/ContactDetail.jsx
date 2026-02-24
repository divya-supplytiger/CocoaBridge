import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { dbApi } from "../lib/api.js";
import ItemDetail from "../components/ItemDetail.jsx";
import RelatedRecordsCard from "../components/RelatedRecordsCard.jsx";

// Deduplicate ContactLink rows by the linked entity's own id.
// The same entity can appear multiple times (once per contact role —
// PRIMARY, SECONDARY, etc.), so we keep only the first occurrence.
const uniqueById = (arr) => {
  const seen = new Set();
  return arr.filter(({ id }) => seen.has(id) ? false : seen.add(id));
};

const ContactDetail = () => {
  const { id } = useParams();

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["contact", id],
    queryFn: () => dbApi.getContact(id),
  });

  const item = result?.data;

  const opportunityLinks = uniqueById(
    item?.links
      ?.filter((l) => l.opportunity)
      .map((l) => ({ id: l.opportunity.id, to: `/opportunities/${l.opportunity.id}`, label: l.opportunity.title ?? "Untitled Opportunity" })) ?? []
  );

  const industryDayLinks = uniqueById(
    item?.links
      ?.filter((l) => l.industryDay)
      .map((l) => ({ id: l.industryDay.id, to: `/industry-days/${l.industryDay.id}`, label: l.industryDay.title ?? "Untitled Industry Day" })) ?? []
  );

  const buyingOrgLinks = uniqueById(
    item?.links
      ?.filter((l) => l.buyingOrganization)
      .map((l) => ({ id: l.buyingOrganization.id, to: `/buying-orgs/${l.buyingOrganization.id}`, label: l.buyingOrganization.name })) ?? []
  );

  const fields = [
    { label: "Email", value: item?.email },
    { label: "Phone", value: item?.phone },
    { label: "Title", value: item?.title },
  ];

  return (
    <div>
      <ItemDetail
        isLoading={isLoading}
        isError={isError}
        error={error}
        item={item}
        backTo="/contacts"
        backLabel="Back to Contacts"
        title={item?.fullName ?? "Contact"}
        fields={fields}
      />
      {item && (
        <RelatedRecordsCard
          opportunityLinks={opportunityLinks}
          industryDayLinks={industryDayLinks}
          buyingOrgLinks={buyingOrgLinks}
        />
      )}
    </div>
  );
};

export default ContactDetail;
