import React from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
const ItemDetail = ({
  isLoading,
  isError,
  error,
  item,
  backTo,
  backLabel,
  title,
  badges,
  description,
  fields = [],
  children,
}) => {
  return (
    <div className="max-w-full">
      <Link to={backTo} className="btn btn-ghost btn-md mb-4">
        <ArrowLeft className="mr-2" />
        {backLabel}
      </Link>

      {isLoading ? (
        <div className="flex justify-center py-12 mx-2">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : isError ? (
        <div className="alert alert-error">{error?.message ?? "Failed to load"}</div>
      ) : item ? (
        <div className="card bg-base-200 shadow-md">
          <div className="card-body gap-3">
            <h2 className="card-title">{title}</h2>
            {badges && (
              <div className="flex gap-2 flex-wrap">{badges}</div>
            )}
            {description && (
              <p className="text-base-content/80 text-sm">{description}</p>
            )}
            {children}
            <div className="divider my-1" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {fields.map(({ label, value, render }) => (
                <React.Fragment key={label}>
                  <dt className="font-semibold">{label}</dt>
                  <dd>{render ? render(value) : (value ?? "—")}</dd>
                </React.Fragment>
              ))}
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ItemDetail;
