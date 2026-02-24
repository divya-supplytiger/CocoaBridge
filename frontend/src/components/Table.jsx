import React from 'react'
import { useNavigate } from 'react-router'
import Row from "./Row.jsx";

const Table = ({ isLoading, isError, error, data, columns, meta, page, onPageChange, basePath }) => {
  const navigate = useNavigate();
  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 1;
  const showPagination = meta && meta.total > meta.limit;

  return (
    <div className="card bg-base-200 shadow-md">
      <div className="card-body">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : isError ? (
          <div className="text-center py-12 text-base-content/60">
            <p className="text-xl font-semibold mb-2">Oops!</p>
            <span className="text-red-500 text-sm">{error?.message ?? "Please try again"}</span>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-base-content/60">
            <p className="text-xl font-semibold mb-2">No Data</p>
            <p className="text-sm">Data will appear here once available.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col.accessor}>{col.header}</th>
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
              <div className="flex justify-center mt-4">
                <div className="join text-secondary-content">
                  <button
                    className="join-item btn bg-secondary border border-secondary-content"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 1}
                  >
                    Prev
                  </button>
                  <button className="join-item btn bg-base-400 pointer-events-none border border-secondary-content">
                    Page {page} of {totalPages}
                  </button>
                  <button
                    className="join-item btn bg-secondary border border-secondary-content"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Table;
