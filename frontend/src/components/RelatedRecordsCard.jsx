import { Link } from 'react-router';

const truncate = (str, n) => str && str.length > n ? `${str.slice(0, n)}…` : (str ?? "—");

const RelatedRecordsCard = ({ opportunity, award }) => {
  if (!opportunity && !award) return null;

  return (
    <div className="collapse collapse-arrow bg-primary text-primary-content rounded-box">
      <input type="checkbox" />
      <div className="collapse-title font-semibold">Related Records</div>
      <div className="collapse-content flex flex-col gap-4">
        {opportunity && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase opacity-70">Opportunity</span>
            <span className="text-sm">{truncate(opportunity.title, 80)}</span>
            <Link to={`/opportunities/${opportunity.id}`} className="btn btn-sm btn-neutral mt-1">View</Link>
          </div>
        )}
        {award && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase opacity-70">Award</span>
            <span className="text-sm">{truncate(award.description, 80)}</span>
            <Link to={`/awards/${award.id}`} className="btn btn-sm btn-neutral mt-1">View</Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default RelatedRecordsCard;
