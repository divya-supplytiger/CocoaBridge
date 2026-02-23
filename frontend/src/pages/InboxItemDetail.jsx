import { useParams } from 'react-router';
import { useQuery } from "@tanstack/react-query";
import { dbApi } from "../lib/api.js";
import ItemDetail from "../components/ItemDetail.jsx";
import RelatedRecordsCard from "../components/RelatedRecordsCard.jsx";

const STATUS_BADGE = {
  NEW: "badge-neutral",
  IN_REVIEW: "badge-warning",
  QUALIFIED: "badge-success",
  DISMISSED: "badge-error",
  CONTACTED: "badge-info",
  CLOSED: "badge-ghost",
};

const InboxItemDetail = () => {
  const { id } = useParams();

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["inboxItem", id],
    queryFn: () => dbApi.getInboxItem(id),
  });

  const item = result?.data;

  const badges = (
    <>
      <span className={`badge ${STATUS_BADGE[item?.reviewStatus] ?? "badge-neutral"}`}>{item?.reviewStatus}</span>
      <span className="badge badge-outline">{item?.type}</span>
      <span className="badge badge-outline">{item?.acquisitionPath}</span>
    </>
  );

  const fields = [
    { label: "Source", value: item?.source },
    { label: "Tag", value: item?.tag },
    { label: "Reviewed By", value: item?.reviewedBy },
    { label: "Reviewed At", value: item?.reviewedAt, render: (val) => val ? new Date(val).toLocaleString() : "—" },
    { label: "Created", value: item?.createdAt, render: (val) => val ? new Date(val).toLocaleString() : "—" },
  ];

  return (
    <ItemDetail
      isLoading={isLoading}
      isError={isError}
      error={error}
      item={item}
      backTo="/inbox"
      backLabel="Back to Inbox"
      title={item?.title ?? "Untitled"}
      badges={badges}
      description={item?.summary}
      fields={fields}
    >
      {item?.notes && (
        <div>
          <p className="font-semibold text-sm">Notes</p>
          <p className="text-sm text-base-content/80">{item.notes}</p>
        </div>
      )}
            <RelatedRecordsCard opportunity={item?.opportunity} award={item?.award} />

    </ItemDetail>
  );
};

export default InboxItemDetail;
