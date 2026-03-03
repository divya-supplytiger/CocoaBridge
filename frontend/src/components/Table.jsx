import { useNavigate } from 'react-router';
import { ChevronUp, ChevronDown } from 'lucide-react';
import PaginationButton from './PaginationButton.jsx';
import Row from "./Row.jsx";

const Table = ({ isLoading, isError, error, data, columns, meta, page, onPageChange, basePath, emptyMessage, emptySubMessage, sort, onSort }) => {
  const navigate = useNavigate();
  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 1;
  const showPagination = meta && meta.total > meta.limit;

  return (
    <div className="card bg-base-100 text-primary-content shadow-md">
      <div className="card-body">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : isError ? (
          <div className="text-center py-12 text-accent-content/60">
            <p className="text-xl font-semibold mb-2">Oops!</p>
            <span className="text-red-500 text-sm">{error?.message ?? "Please try again"}</span>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-accent-content/60">
            <p className="text-xl font-semibold mb-2">{emptyMessage ?? "No Data"}</p>
            <p className="text-sm">{emptySubMessage ?? "Data will appear here once available."}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.accessor}
                        onClick={col.sortable && onSort ? () => onSort(col.accessor) : undefined}
                        className={col.sortable ? "cursor-pointer select-none hover:bg-base-200" : ""}
                      >
                        <span className="flex items-center gap-2">
                          {col.header}
                          {col.sortable && sort?.field === col.accessor && (
                            sort.dir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <Row
                      key={row.id}
                      onClick={basePath ? () => navigate(`${basePath}/${row.id}`) : undefined}
                    >
                      {columns.map((col) => (
                        <td key={col.accessor}>
                          {col.render ? col.render(row[col.accessor], row) : row[col.accessor]}
                        </td>
                      ))}
                    </Row>
                  ))}
                </tbody>
              </table>
            </div>
            {showPagination && (
              <PaginationButton
                totalPages={totalPages}
                currentPage={page}
                onPageChange={onPageChange}
              />
            )}
                 
          </>
        )}
      </div>
    </div>
  );
};

export default Table;
