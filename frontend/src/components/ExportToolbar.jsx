import { Download } from "lucide-react";
import { exportSelectedToCsv, downloadBlob, csvFilename } from "../lib/csvExport.js";

const ExportToolbar = ({ selectedIds, data, csvColumns, entityName, exportAllFn, filterParams }) => {
  const selectedCount = selectedIds?.size ?? 0;

  const handleExportSelected = () => {
    const selectedRows = data.filter((r) => selectedIds.has(r.id));
    exportSelectedToCsv(csvColumns, selectedRows, csvFilename(entityName));
  };

  const handleExportAll = async () => {
    try {
      const res = await exportAllFn(filterParams);
      downloadBlob(res.data, csvFilename(entityName));
    } catch (err) {
      console.error("Export all failed:", err);
    }
  };

  return (
    <div className="flex items-center gap-2 mb-3">
      <button
        className="btn btn-sm btn-primary gap-1"
        disabled={selectedCount === 0}
        onClick={handleExportSelected}
      >
        <Download className="size-4" />
        Export Selected{selectedCount > 0 ? ` (${selectedCount})` : ""}
      </button>
      <button
        className="btn btn-sm btn-primary gap-1"
        onClick={handleExportAll}
      >
        <Download className="size-4" />
        Export All
      </button>
    </div>
  );
};

export default ExportToolbar;
