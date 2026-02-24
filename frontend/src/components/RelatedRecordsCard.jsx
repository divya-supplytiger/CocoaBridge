import { Link } from 'react-router';

const truncate = (str, n) => str && str.length > n ? `${str.slice(0, n)}…` : (str ?? "—");

const TYPE_LABEL = { PRIMARY: "Primary", SECONDARY: "Secondary", OTHER: "Other" };

/**
 * Displays a collapsible "Related Records" card linking to entities associated
 * with the current record.
 *
 * Supports three usage patterns:
 *
 * 1. Single-item mode (InboxItemDetail) — pass `opportunity` and/or `award`
 *    as plain objects with { id, title/description }. Used when an inbox item
 *    is directly linked to one opportunity or one award.
 *
 * 2. Multi-item list mode (ContactDetail) — pass `opportunityLinks`,
 *    `industryDayLinks`, and/or `buyingOrgLinks` as arrays of
 *    { id, to, label } objects. Used when a Contact is linked to multiple
 *    entities via the ContactLink join table. ContactLink can produce
 *    duplicate rows for the same entity (one per contact role — PRIMARY,
 *    SECONDARY, etc.), so callers must deduplicate by entity id before
 *    passing in.
 *
 * 3. Contact button mode (OpportunityDetail) — pass `contactLinks` as an
 *    array of { id, to, type } objects where `type` is a ContactType enum
 *    value (PRIMARY, SECONDARY, OTHER). Renders one button per contact link
 *    labeled by role rather than name, linking to the contact detail page.
 */
const RelatedRecordsCard = ({
  // Single-item mode
  opportunity,
  award,
  // Multi-item list mode
  opportunityLinks = [],
  industryDayLinks = [],
  buyingOrgLinks = [],
  // Contact button mode
  contactLinks = [],
}) => {
  const hasSingleItems = opportunity || award;
  const hasListItems = opportunityLinks.length > 0 || industryDayLinks.length > 0 || buyingOrgLinks.length > 0;
  const hasContactButtons = contactLinks.length > 0;

  if (!hasSingleItems && !hasListItems && !hasContactButtons) return null;

  return (
    <div className="collapse collapse-arrow bg-secondary text-secondary-content rounded-box mt-2">
      <input type="checkbox" />
      <div className="collapse-title font-semibold card-title border-b border-secondary-content">Related Records</div>
      <div className="collapse-content flex flex-col gap-4 pt-2">

        {/* Single-item mode: one opportunity */}
        {opportunity && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase opacity-70">Opportunity</span>
            <span className="text-sm">{truncate(opportunity.title, 80)}</span>
            <Link to={`/opportunities/${opportunity.id}`} className="btn btn-sm btn-neutral mt-1">View</Link>
          </div>
        )}

        {/* Single-item mode: one award */}
        {award && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase opacity-70">Award</span>
            <span className="text-sm">{truncate(award.description, 80)}</span>
            <Link to={`/awards/${award.id}`} className="btn btn-sm btn-neutral mt-1">View</Link>
          </div>
        )}

        {/* Multi-item list mode: opportunities */}
        {opportunityLinks.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase opacity-70">
              Opportunities ({opportunityLinks.length})
            </span>
            <ul className="flex flex-col gap-1">
              {opportunityLinks.map((link) => (
                <li key={link.id}>
                  <Link to={link.to} className="link text-sm opacity-90 hover:opacity-100">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Multi-item list mode: industry days */}
        {industryDayLinks.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase opacity-70">
              Industry Days ({industryDayLinks.length})
            </span>
            <ul className="flex flex-col gap-1">
              {industryDayLinks.map((link) => (
                <li key={link.id}>
                  <Link to={link.to} className="link text-sm opacity-90 hover:opacity-100">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Multi-item list mode: buying organizations */}
        {buyingOrgLinks.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase opacity-70">
              Buying Organizations ({buyingOrgLinks.length})
            </span>
            <ul className="flex flex-col gap-1">
              {buyingOrgLinks.map((link) => (
                <li key={link.id}>
                  <Link to={link.to} className="link text-sm opacity-90 hover:opacity-100">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Contact button mode: role-labeled buttons */}
        {contactLinks.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase opacity-70">Contacts</span>
            <div className="flex flex-wrap gap-2">
              {contactLinks.map((link) => (
                <Link
                  key={link.id}
                  to={link.to}
                  className={`btn btn-sm ${link.type === "PRIMARY" ? "btn-neutral" : "btn-ghost"}`}
                >
                  {TYPE_LABEL[link.type] ?? link.type}
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default RelatedRecordsCard;
