import { useState } from "react";
import { useParams } from "react-router";
import { Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { dbApi } from "../lib/api.js";
import { useCurrentUser } from "../lib/CurrentUserContext.jsx";
import ItemDetail from "../components/ItemDetail.jsx";
import RelatedRecordsCard from "../components/RelatedRecordsCard.jsx";

const BuyingOrgDetail = () => {
  const { id } = useParams();
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === "ADMIN";
  const queryClient = useQueryClient();

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ["buying-org", id],
    queryFn: () => dbApi.getBuyingOrg(id),
  });

  const item = result?.data;

  const { data: parentResult } = useQuery({
    queryKey: ["buying-org", item?.parentId],
    queryFn: () => dbApi.getBuyingOrg(item.parentId),
    enabled: !!item?.parentId,
  });

  const parent = parentResult?.data;

  const [childPage, setChildPage] = useState(1);
  const CHILD_PAGE_SIZE = 10;

  const [website, setWebsite] = useState(null);

  const websiteValue = website ?? (item?.website ?? "");

  const { mutate: saveBuyingOrg, isPending: isSaving } = useMutation({
    mutationFn: () => dbApi.updateBuyingOrg(id, { website: websiteValue }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buying-org", id] });
      toast.success("Saved");
    },
    onError: (err) => toast.error(err?.response?.data?.error ?? "Failed to save"),
  });

  const badges = item?.level ? (
    <span className="badge badge-primary">{item.level}</span>
  ) : null;

  const fields = [
    { label: "Level", value: item?.level },
    { label: "External ID", value: item?.externalId },
    {
      label: "Website",
      value: item?.website
        ? <Link to={item.website} target="_blank" rel="noopener noreferrer" className="link link-primary">{item.website}</Link>
        : null,
    },
  ];

  const children = item?.children ?? [];

  const opportunityLinks = (item?.opportunities ?? []).map((o) => ({
    id: o.id,
    to: `/opportunities/${o.id}`,
    label: o.title ?? "Untitled Opportunity",
    meta: o.postedDate ? new Date(o.postedDate).toLocaleDateString() : undefined,
  }));

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
      >
        {(parent || children.length > 0) && (
          <div className="flex flex-col gap-3 text-sm">
            {parent && (
              <div>
                <p className="font-semibold mb-1">Parent Organization</p>
                <Link
                  to={`/buying-orgs/${parent.id}`}
                  className="flex items-center gap-2 link link-hover"
                >
                  <span className="badge badge-accent badge-sm text-secondary-content">{parent.level}</span>
                  {parent.name}
                </Link>
              </div>
            )}
            {children.length > 0 && (
              <div>
                <p className="font-semibold mb-1">Sub-Organizations ({children.length})</p>
                <ul className="flex flex-col gap-1">
                  {children.slice((childPage - 1) * CHILD_PAGE_SIZE, childPage * CHILD_PAGE_SIZE).map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/buying-orgs/${c.id}`}
                        className="flex items-center gap-2 link link-hover"
                      >
                        <span className="badge badge-outline badge-sm text-primary-content">{c.level}</span>
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                {children.length > CHILD_PAGE_SIZE && (
                  <div className="join mt-2">
                    <button className="join-item btn btn-xs" onClick={() => setChildPage((p) => p - 1)} disabled={childPage === 1}>«</button>
                    <span className="join-item btn btn-xs btn-disabled pointer-events-none">{childPage} / {Math.ceil(children.length / CHILD_PAGE_SIZE)}</span>
                    <button className="join-item btn btn-xs" onClick={() => setChildPage((p) => p + 1)} disabled={childPage === Math.ceil(children.length / CHILD_PAGE_SIZE)}>»</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {isAdmin && item && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold">Edit Organization</p>
            <div className="flex flex-col gap-2">
              <label className="text-sm">Website</label>
              <input
                type="text"
                className="input input-bordered input-sm w-full max-w-xs"
                placeholder="Add website…"
                value={websiteValue}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary btn-sm w-fit"
              onClick={() => saveBuyingOrg()}
              disabled={isSaving}
            >
              {isSaving ? <span className="loading loading-spinner loading-xs" /> : "Save"}
            </button>
          </div>
        )}
      </ItemDetail>
      {item && <RelatedRecordsCard opportunityLinks={opportunityLinks} />}
    </div>
  );
};

export default BuyingOrgDetail;
