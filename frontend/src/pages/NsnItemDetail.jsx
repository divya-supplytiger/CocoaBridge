import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { dbApi } from "../lib/api.js";
import ItemDetail from "../components/ItemDetail.jsx";

const NsnItemDetail = () => {
  const { id } = useParams();

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["nsn-item", id],
    queryFn: () => dbApi.getNsnItem(id),
  });

  const item = result?.data;

  const fields = [
    { label: "NSN", value: item?.nsn },
    { label: "NIIN", value: item?.niin },
    { label: "PSC", value: item?.pscCode && item?.pscClass?.title ? `${item.pscCode} — ${item.pscClass.title}` : item?.pscCode },
    { label: "Common Name", value: item?.commonName },
  ];

  return (
    <ItemDetail
      isLoading={isLoading}
      isError={isError}
      error={error}
      item={item}
      backTo="/market-intelligence"
      backLabel="Back to Market Intelligence"
      title={item?.itemName ?? "NSN Item"}
      fields={fields}
      description={item?.characteristics}
    />
  );
};

export default NsnItemDetail;
