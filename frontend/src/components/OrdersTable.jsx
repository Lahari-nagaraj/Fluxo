import { useMemo, useState } from "react";
import { PackageOpen, RefreshCw } from "lucide-react";
import OrderFilters from "./OrderFilters";

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function StatusBadge({ status }) {
  const normalized = (status || "UNKNOWN").toLowerCase();

  return (
    <span className={`order-status status-${normalized}`}>
      <span className="status-dot" />
      {status || "UNKNOWN"}
    </span>
  );
}

export default function OrdersTable({
  orders,
  loading,
  error,
  onRefresh,
  onViewAll,
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus =
        status === "ALL" || (order.status || "").toUpperCase() === status;

      const matchesSearch =
        !query ||
        order.order_id?.toLowerCase().includes(query) ||
        order.customer_id?.toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [orders, search, status]);

  return (
    <section className="panel orders-panel">
      <div className="panel-header">
        <div>
          <h3>Recent orders</h3>
          <p>
            Showing {filteredOrders.length} of {orders.length} orders
          </p>
        </div>

        <div className="table-actions">
          <button
            className="icon-button"
            onClick={onRefresh}
            aria-label="Refresh orders"
            title="Refresh orders"
            disabled={loading}
          >
            <RefreshCw size={16} />
          </button>

          {onViewAll && (
            <button className="text-button" onClick={onViewAll}>
              View all
            </button>
          )}
        </div>
      </div>

      <OrderFilters
        search={search}
        onSearch={setSearch}
        status={status}
        onStatus={setStatus}
        onRefresh={onRefresh}
        loading={loading}
      />

      {error && <p className="inline-error">{error}</p>}

      {loading ? (
        <div className="table-message">Loading orders…</div>
      ) : filteredOrders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <PackageOpen size={25} />
          </div>

          <h4>
            {orders.length === 0 ? "No orders found" : "No matching orders"}
          </h4>

          <p>
            {orders.length === 0
              ? "The Order Service returned no order records."
              : "Try changing the search text or status filter."}
          </p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Pickup zone</th>
                <th>Created</th>
              </tr>
            </thead>

            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.order_id}>
                  <td>
                    <span className="order-id">
                      {order.order_id?.slice(0, 8) || "—"}
                    </span>
                  </td>

                  <td>{order.customer_id || "—"}</td>

                  <td>
                    <StatusBadge status={order.status} />
                  </td>

                  <td>{order.priority || "—"}</td>

                  <td>{order.pickup_zone_id || "—"}</td>

                  <td>{formatDate(order.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
