import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  Package,
  Truck,
  MapPinned,
  Activity,
  Plus,
  CheckCircle2,
} from "lucide-react";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import StatCard from "./components/StatCard";
import OrdersTable from "./components/OrdersTable";
import DriversTable from "./components/DriversTable";
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
      console.error("Location Socket.IO connection failed:", err.message);
    });

    return () => {
      socket.off("driver_location_updated", applyLocationUpdate);
      socket.disconnect();
    };
  }, [applyLocationUpdate]);

  const availableDrivers = drivers.filter(
    (driver) => driver.status === "AVAILABLE",
  ).length;

  const activeDeliveries = orders.filter((order) =>
    ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"].includes(order.status),
  ).length;

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
        `Order ${createdOrder?.order_id || ""} created successfully.`,
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
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

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
                {activePage === "Overview" ? "Operations overview" : activePage}
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
              <button className="text-button" onClick={refresh}>
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
                    loading ? "Checking…" : error ? "API issue" : "Connected"
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
                    <Activity size={19} className="muted-icon" />
                  </div>

                  <div className="network-summary">
                    <div className="summary-row">
                      <span>Drivers loaded</span>
                      <strong>{drivers.length}</strong>
                    </div>

                    <div className="summary-row">
                      <span>Drivers with locations</span>
                      <strong>{Object.keys(locations).length}</strong>
                    </div>

                    <div className="summary-row">
                      <span>Orders awaiting assignment</span>
                      <strong>
                        {
                          orders.filter(
                            (order) => order.status === "SEARCHING_DRIVER",
                          ).length
                        }
                      </strong>
                    </div>

                    <div className="summary-row">
                      <span>Assigned orders</span>
                      <strong>
                        {
                          orders.filter((order) => order.status === "ASSIGNED")
                            .length
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
                  {showCreateOrder ? "Close form" : "Create order"}
                </button>
              </div>

              {createSuccess && (
                <div className="create-success" role="status">
                  <CheckCircle2 size={18} />
                  <span>{createSuccess}</span>
                  <button className="text-button" onClick={refresh}>
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
            <LiveMap drivers={drivers} locations={locations} orders={orders} />
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

              <button className="refresh-button" onClick={refresh}>
                Refresh backend data
              </button>
            </section>
          )}

          <footer className="page-footer">
            <span>FLUXO DELIVERY ORCHESTRATION PLATFORM</span>
            <span>Distributed logistics · Real-time location events</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
