import { RefreshCw, Truck } from "lucide-react";

export default function DriversTable({
  drivers,
  locations,
  loading,
  onRefresh,
}) {
  return (
    <section className="panel orders-panel">
      <div className="panel-header">
        <div>
          <h3>Driver fleet</h3>
          <p>{drivers.length} drivers returned by the Driver Service</p>
        </div>

        <button
          className="icon-button"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh drivers"
          title="Refresh drivers"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="table-message">Loading drivers…</div>
      ) : drivers.length === 0 ? (
        <div className="empty-state">
          <Truck size={25} />
          <h4>No drivers found</h4>
          <p>The Driver Service returned no driver records.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Vehicle</th>
                <th>Status</th>
                <th>Location</th>
                <th>Zone</th>
                <th>Last heartbeat</th>
              </tr>
            </thead>

            <tbody>
              {drivers.map((driver) => {
                const location = locations[driver.driver_id];
                const status = (driver.status || "UNKNOWN").toLowerCase();

                return (
                  <tr key={driver.driver_id}>
                    <td>
                      <strong>{driver.name || "Unnamed driver"}</strong>
                      <br />
                      <span className="muted-cell">
                        {driver.driver_id.slice(0, 8)}
                      </span>
                    </td>
                    <td>{driver.vehicle_type || "—"}</td>
                    <td>
                      <span className={`order-status status-${status}`}>
                        <span className="status-dot" />
                        {driver.status || "UNKNOWN"}
                      </span>
                    </td>
                    <td>
                      {location
                        ? `${Number(location.latitude).toFixed(4)}, ${Number(location.longitude).toFixed(4)}`
                        : "Unavailable"}
                    </td>
                    <td>{location?.zone_id || driver.zone_id || "—"}</td>
                    <td>
                      {driver.last_heartbeat
                        ? new Date(driver.last_heartbeat).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
