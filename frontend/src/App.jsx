
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

import {
  Package,
  Truck,
  MapPinned,
  Activity,
  Plus,
  CheckCircle2,
  Bell,
} from "lucide-react";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import StatCard from "./components/StatCard";
import OrdersTable from "./components/OrdersTable";
import DriversTable from "./components/DriversTable";
import DriverPortal from "./components/DriverPortal";
import LiveMap from "./components/LiveMap";
import CreateOrderForm from "./components/CreateOrderForm";
import useDashboardData from "./hooks/useDashboardData";
import { orderApi } from "./services/api";

import "./App.css";

const LOCATION_SOCKET_URL = "http://localhost:3003";

export default function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [createSuccess, setCreateSuccess] = useState("");

  // Assignment alert pop-up state
  const [assignmentAlert, setAssignmentAlert] = useState(null);
  const seenAssignmentsRef = useRef(new Set());

  const {
    orders,
    drivers,
    locations,
    loading,
    error,
    refresh,
    applyLocationUpdate,
  } = useDashboardData();

  useEffect(() => {
    const socket = io(LOCATION_SOCKET_URL);

    socket.on("driver_location_updated", applyLocationUpdate);

    socket.on("connect_error", (err) => {
      console.error(
        "Location Socket.IO connection failed:",
        err.message
      );
    });

    return () => {
      socket.off("driver_location_updated", applyLocationUpdate);
      socket.disconnect();
    };
  }, [applyLocationUpdate]);

  const availableDrivers = drivers.filter(
    (driver) => driver.status === "AVAILABLE"
  ).length;

  const activeDeliveries = orders.filter((order) =>
    ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"].includes(order.status)
  ).length;

  // Pop-up alert reminder whenever any order with saved door instructions is assigned to a driver
  useEffect(() => {
    for (const order of orders) {
      if (
        order.driver_id &&
        order.delivery_instructions &&
        ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"].includes(order.status)
      ) {
        const key = `${order.order_id}_${order.driver_id}`;
        if (!seenAssignmentsRef.current.has(key)) {
          seenAssignmentsRef.current.add(key);
          setAssignmentAlert({
            orderId: order.order_id,
            driverId: order.driver_id,
            locationId: order.location_id,
            instructions: order.delivery_instructions,
          });

          // Trigger browser alert popup as requested
          setTimeout(() => {
            window.alert(
              `🔔 REACH-THE-DOOR REMINDER ALERT!\n\n` +
              `Driver ${order.driver_id} has been assigned to location: ${order.location_id || "Saved Destination"}\n\n` +
              `Stored Reach-The-Door Directions:\n"${order.delivery_instructions}"\n\n` +
              `Order ID: ${order.order_id}`
            );
          }, 250);
        }
      }
    }
  }, [orders]);

  const sharedTableProps = {
    orders,
    loading,
    error,
    onRefresh: refresh,
  };

  async function handleCreateOrder(payload) {
    setCreatingOrder(true);
    setCreateSuccess("");

    try {
      const response = await orderApi.create(payload);
      const createdOrder = response.data?.data;

      setShowCreateOrder(false);

      setCreateSuccess(
        `Order ${createdOrder?.order_id || ""} created successfully.`
      );

      await refresh();
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Order creation failed.";

      throw new Error(message);
    } finally {
      setCreatingOrder(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
      />

      <main className="main-content">
        <Topbar activePage={activePage} />

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-dot" />
                DELIVERY OPERATIONS
              </div>

              <h1>
                {activePage === "Overview"
                  ? "Operations overview"
                  : activePage}
              </h1>

              <p className="page-subtitle">
                Your delivery network, all in one place.
              </p>
            </div>

            <div className="environment-badge">
              <span className="status-dot" />
              Local development
            </div>
          </section>

          {error && (
            <div className="dashboard-error">
              {error}
              <button
                className="text-button"
                onClick={refresh}
              >
                Retry
              </button>
            </div>
          )}

          {activePage === "Overview" && (
            <>
              <section className="stats-grid">
                <StatCard
                  title="Total orders"
                  value={loading ? "…" : orders.length}
                  description="Orders in the Order Service"
                  icon={Package}
                  accent="violet"
                />

                <StatCard
                  title="Available drivers"
                  value={loading ? "…" : availableDrivers}
                  description="Current Driver Service status"
                  icon={Truck}
                  accent="green"
                />

                <StatCard
                  title="Active deliveries"
                  value={loading ? "…" : activeDeliveries}
                  description="Assigned, picked up, or in transit"
                  icon={MapPinned}
                  accent="blue"
                />

                <StatCard
                  title="API status"
                  value={
                    loading
                      ? "Checking…"
                      : error
                        ? "API issue"
                        : "Connected"
                  }
                  description="Orders and Drivers API requests"
                  icon={Activity}
                  accent="orange"
                />
              </section>

              <section className="content-grid">
                <LiveMap
                  drivers={drivers}
                  locations={locations}
                  orders={orders}
                />

                <section className="panel activity-panel">
                  <div className="panel-header">
                    <div>
                      <h3>Network summary</h3>
                      <p>Current backend data</p>
                    </div>

                    <Activity
                      size={19}
                      className="muted-icon"
                    />
                  </div>

                  <div className="network-summary">
                    <div className="summary-row">
                      <span>Drivers loaded</span>
                      <strong>{drivers.length}</strong>
                    </div>

                    <div className="summary-row">
                      <span>Drivers with locations</span>
                      <strong>
                        {Object.keys(locations).length}
                      </strong>
                    </div>

                    <div className="summary-row">
                      <span>Orders awaiting assignment</span>
                      <strong>
                        {
                          orders.filter(
                            (order) =>
                              order.status === "SEARCHING_DRIVER"
                          ).length
                        }
                      </strong>
                    </div>

                    <div className="summary-row">
                      <span>Assigned orders</span>
                      <strong>
                        {
                          orders.filter(
                            (order) => order.status === "ASSIGNED"
                          ).length
                        }
                      </strong>
                    </div>

                    <button
                      className="refresh-button"
                      onClick={refresh}
                      disabled={loading}
                    >
                      Refresh backend data
                    </button>
                  </div>
                </section>
              </section>

              <OrdersTable {...sharedTableProps} />
            </>
          )}

          {activePage === "Orders" && (
            <>
              <div className="orders-page-actions">
                <button
                  className="primary-button"
                  onClick={() => {
                    setCreateSuccess("");
                    setShowCreateOrder((current) => !current);
                  }}
                >
                  <Plus size={16} />

                  {showCreateOrder
                    ? "Close form"
                    : "Create order"}
                </button>
              </div>

              {createSuccess && (
                <div
                  className="create-success"
                  role="status"
                >
                  <CheckCircle2 size={18} />

                  <span>{createSuccess}</span>

                  <button
                    className="text-button"
                    onClick={refresh}
                  >
                    Refresh status
                  </button>
                </div>
              )}

              {showCreateOrder && (
                <CreateOrderForm
                  onClose={() => setShowCreateOrder(false)}
                  onSubmit={handleCreateOrder}
                  submitting={creatingOrder}
                />
              )}

              <OrdersTable {...sharedTableProps} />
            </>
          )}

          {activePage === "Drivers" && (
            <DriversTable
              drivers={drivers}
              locations={locations}
              loading={loading}
              onRefresh={refresh}
            />
          )}

          {activePage === "Live Tracking" && (
            <LiveMap
              drivers={drivers}
              locations={locations}
              orders={orders}
            />
          )}

          {activePage === "System" && (
            <section className="panel network-summary">
              <h3>Service connectivity</h3>

              <p className="page-subtitle">
                Orders and Drivers data loaded through the API Gateway.
              </p>

              <div className="summary-row">
                <span>Order records</span>
                <strong>{orders.length}</strong>
              </div>

              <div className="summary-row">
                <span>Driver records</span>
                <strong>{drivers.length}</strong>
              </div>

              <div className="summary-row">
                <span>Location records</span>
                <strong>{Object.keys(locations).length}</strong>
              </div>

              <button
                className="refresh-button"
                onClick={refresh}
              >
                Refresh backend data
              </button>
            </section>
          )}

          <footer className="page-footer">
            <span>
              FLUXO DELIVERY ORCHESTRATION PLATFORM
            </span>

            <span>
              Distributed logistics · Real-time location events
            </span>
          </footer>
        </div>
      </main>

      {/* Keep DriverPortal mounted when switching dashboard pages.
          This prevents its cleanup effect from stopping location sharing
          just because another page is selected. */}
      <div
        style={{
          display:
            activePage === "Driver Portal" ? "block" : "none",
        }}
      >
        <DriverPortal orders={orders} onRefreshOrders={refresh} />
      </div>

      {/* Floating Reach-the-Door Assignment Reminder Toast */}
      {assignmentAlert && (
        <aside className="assignment-alert-toast" role="alert">
          <div className="alert-toast-header">
            <span className="bell-toast-icon">🔔</span>
            <strong>Driver Assigned with Door Instructions!</strong>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => setAssignmentAlert(null)}
              aria-label="Dismiss alert"
            >
              ✕
            </button>
          </div>
          <p className="alert-toast-body">
            "{assignmentAlert.instructions}"
          </p>
          <div className="alert-toast-meta">
            <span>Location: <code>{assignmentAlert.locationId || "N/A"}</code></span>
            <span>Driver: <code>{assignmentAlert.driverId?.slice(0, 8)}</code></span>
          </div>
        </aside>
      )}
    </div>
  );
}
