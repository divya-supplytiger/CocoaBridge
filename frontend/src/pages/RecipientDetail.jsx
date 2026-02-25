import { useParams } from 'react-router';
import { useQuery } from "@tanstack/react-query";
import { Link } from 'react-router';
import { dbApi } from "../lib/api.js";
import ItemDetail from "../components/ItemDetail.jsx";

const truncate = (str, n) => str && str.length > n ? `${str.slice(0, n)}…` : (str ?? "—");

const RecipientDetail = () => {
  const { id } = useParams();

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["recipient", id],
    queryFn: () => dbApi.getRecipient(id),
  });

  const item = result?.data;

  const fields = [
    { label: "UEI", value: item?.uei },
    { label: "Website", value: item?.website },
  ];

  return (
    <div>
      <ItemDetail
        isLoading={isLoading}
        isError={isError}
        error={error}
        item={item}
        backTo="/market-intelligence"
        backLabel="Back to Market Intelligence"
        title={item?.name ?? "Recipient"}
        fields={fields}
      />
      {item?.awards?.length > 0 && (
        <div className="collapse collapse-arrow bg-secondary text-secondary-content rounded-box mt-2">
          <input type="checkbox" />
          <div className="collapse-title font-semibold card-title border-b border-secondary-content">
            Awards ({item.awards.length})
          </div>
          <div className="collapse-content pt-2">
            <ul className="flex flex-col gap-2">
              {item.awards.map((award) => (
                <li key={award.id} className="flex flex-col gap-1 border-b border-secondary-content/20 pb-2 last:border-0">
                  <span className="text-sm">{truncate(award.description, 60)}</span>
                  <div className="flex gap-4 text-xs opacity-70">
                    {award.obligatedAmount != null && (
                      <span>${Number(award.obligatedAmount).toLocaleString()}</span>
                    )}
                    {award.startDate && (
                      <span>{new Date(award.startDate).toLocaleDateString()}</span>
                    )}
                  </div>
                  <Link to={`/awards/${award.id}`} className="btn btn-xs btn-neutral w-fit mt-1">
                    View Award
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipientDetail;
