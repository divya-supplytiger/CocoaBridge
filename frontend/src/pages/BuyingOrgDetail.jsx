import { useParams } from 'react-router';
import { useQuery } from "@tanstack/react-query";
import { Link } from 'react-router';
import { dbApi } from "../lib/api.js";
import ItemDetail from "../components/ItemDetail.jsx";

const truncate = (str, n) => str && str.length > n ? `${str.slice(0, n)}…` : (str ?? "—");

const BuyingOrgDetail = () => {
  const { id } = useParams();

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["buying-org", id],
    queryFn: () => dbApi.getBuyingOrg(id),
  });

  const item = result?.data;

  const badges = item?.level ? (
    <span className="badge badge-primary badge-outline">{item.level}</span>
  ) : null;

  const fields = [
    { label: "Level", value: item?.level },
    { label: "Website", value: item?.website },
    { label: "External ID", value: item?.externalId },
    { label: "Full Path", value: item?.pathName },
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
        title={item?.name ?? "Buying Organization"}
        badges={badges}
        fields={fields}
      />
      {item?.children?.length > 0 && (
        <div className="collapse collapse-arrow bg-secondary text-secondary-content rounded-box mt-2">
          <input type="checkbox" />
          <div className="collapse-title font-semibold card-title border-b border-secondary-content">
            Sub-Organizations ({item.children.length})
          </div>
          <div className="collapse-content pt-2">
            <ul className="flex flex-col gap-1">
              {item.children.map((child) => (
                <li key={child.id}>
                  <Link
                    to={`/buying-orgs/${child.id}`}
                    className="link link-primary text-sm opacity-90 hover:opacity-100"
                  >
                    {child.name}
                  </Link>
                  {child.level && (
                    <span className="badge badge-xs badge-outline ml-2">{child.level}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {item?.opportunities?.length > 0 && (
        <div className="collapse collapse-arrow bg-secondary text-secondary-content rounded-box mt-2">
          <input type="checkbox" />
          <div className="collapse-title font-semibold card-title border-b border-secondary-content">
            Recent Opportunities ({item.opportunities.length})
          </div>
          <div className="collapse-content pt-2">
            <ul className="flex flex-col gap-2">
              {item.opportunities.map((opp) => (
                <li key={opp.id} className="flex flex-col gap-1 border-b border-secondary-content/20 pb-2 last:border-0">
                  <span className="text-sm">{truncate(opp.title, 80)}</span>
                  {opp.postedDate && (
                    <span className="text-xs opacity-70">{new Date(opp.postedDate).toLocaleDateString()}</span>
                  )}
                  <Link to={`/opportunities/${opp.id}`} className="btn btn-xs btn-neutral w-fit mt-1">
                    View Opportunity
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

export default BuyingOrgDetail;
