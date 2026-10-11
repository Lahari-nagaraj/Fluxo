import { Search, RefreshCw } from "lucide-react";

const STATUSES = [
  "ALL",
  "CREATED",
  "SEARCHING_DRIVER",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
];

export default function OrderFilters({
  search,
  onSearch,
  status,
  onStatus,
  onRefresh,
  loading,
}) {
  return (
    <div className="order-filters">
      <label className="filter-search">
        <Search size={16} />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search order or customer ID"
        />
      </label>

      <select
        value={status}
        onChange={(event) => onStatus(event.target.value)}
        aria-label="Filter orders by status"
      >
        {STATUSES.map((item) => (
          <option key={item} value={item}>
            {item === "ALL" ? "All statuses" : item.replaceAll("_", " ")}
          </option>
        ))}
      </select>

      <button
        className="icon-button"
        onClick={onRefresh}
        disabled={loading}
        aria-label="Refresh orders"
        title="Refresh orders"
      >
        <RefreshCw size={16} />
      </button>
    </div>
  );
}
