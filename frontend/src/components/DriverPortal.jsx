import { useEffect, useRef, useState } from "react";
import {
  MapPin,
  UserPlus,
  Radio,
  Power,
  Bell,
  KeyRound,
  Save,
  Package,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { driverApi, locationApi, orderApi } from "../services/api";
import "./DriverPortal.css";

export default function DriverPortal({ orders = [], onRefreshOrders }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState("BIKE");
  const [driver, setDriver] = useState(null);
  const [location, setLocation] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Reach-the-Door Instructions state for active delivery
  const [driverNotesInput, setDriverNotesInput] = useState("");
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saveError, setSaveError] = useState("");

  // Manual location lookup state
  const [lookupLocId, setLookupLocId] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const watchRef = useRef(null);
  const timerRef = useRef(null);
  const driverRef = useRef(null);
  const sharingRef = useRef(false);

  useEffect(() => {
    return () => {
      sharingRef.current = false;

      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }

      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  async function sendLocation(position, selectedDriver) {
    const coordinates = {
      driverId: selectedDriver.driver_id,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };

    await locationApi.update(coordinates);

    setLocation({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      updatedAt: new Date().toISOString(),
    });
  }

  async function registerDriver(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await driverApi.create({
        name: name.trim(),
        phone: phone.trim(),
        vehicleType,
        capacity: 1,
      });

      const created = response.data?.data;

      if (!created?.driver_id) {
        throw new Error(
          "Driver was created, but the response did not contain driver_id.",
        );
      }

      setDriver(created);
      driverRef.current = created;
      localStorage.setItem("fluxo_active_driver_id", created.driver_id);
      setName("");
      setPhone("");
      setMessage(`Driver ${created.name} registered successfully. Share your location to continue.`);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "Driver registration failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  function stopSharing() {
    sharingRef.current = false;
    setSharing(false);

    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }

    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setMessage("Location sharing stopped.");
  }

  function startSharing() {
    if (!driverRef.current) return;

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    setError("");
    setMessage("Requesting location permission...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await sendLocation(position, driverRef.current);

          sharingRef.current = true;
          setSharing(true);
          setMessage("Location shared successfully.");

          // Refresh the cache before its 60-second TTL expires.
          timerRef.current = setInterval(() => {
            if (!sharingRef.current || !driverRef.current) return;

            navigator.geolocation.getCurrentPosition(
              async (nextPosition) => {
                try {
                  await sendLocation(nextPosition, driverRef.current);
                } catch (err) {
                  setError(
                    err.response?.data?.message ||
                      err.message ||
                      "Location update failed.",
                  );
                }
              },
              (geoError) => {
                setError(geoError.message);
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
              },
            );
          }, 10000);

          // Watch for changes between periodic refreshes.
          watchRef.current = navigator.geolocation.watchPosition(
            async (nextPosition) => {
              if (!sharingRef.current || !driverRef.current) return;

              try {
                await sendLocation(nextPosition, driverRef.current);
              } catch (err) {
                setError(
                  err.response?.data?.message ||
                    err.message ||
                    "Location update failed.",
                );
              }
            },
            (geoError) => setError(geoError.message),
            {
              enableHighAccuracy: true,
              maximumAge: 5000,
            },
          );
        } catch (err) {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Could not save driver location.",
          );
        }
      },
      (geoError) => {
        setError(`Location permission failed: ${geoError.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }

  async function toggleAvailability() {
    if (!driverRef.current) return;

    const nextStatus =
      driverRef.current.status === "AVAILABLE" ? "OFFLINE" : "AVAILABLE";

    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (nextStatus === "AVAILABLE" && (!sharingRef.current || !location)) {
        throw new Error(
          "Share your location successfully before becoming available.",
        );
      }

      const response = await driverApi.updateStatus(
        driverRef.current.driver_id,
        nextStatus,
      );

      const updated = response.data?.data || {
        ...driverRef.current,
        status: nextStatus,
      };

      setDriver(updated);
      driverRef.current = updated;

      setMessage(`Driver status changed to ${nextStatus}.`);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "Could not update driver status.",
      );
    } finally {
      setBusy(false);
    }
  }

  // Load registered drivers on initial mount and auto-select active driver
  useEffect(() => {
    async function initDriver() {
      try {
        const res = await driverApi.getAll();
        const list = res.data?.data || [];
        if (list.length > 0) {
          const savedId = localStorage.getItem("fluxo_active_driver_id");
          const found = savedId ? list.find((d) => d.driver_id === savedId) : null;
          const chosen = found || list[0];
          setDriver(chosen);
          driverRef.current = chosen;
        }
      } catch {
        // non-critical
      }
    }
    initDriver();
  }, []);

  // Find active order assigned to this driver
  const activeOrder = orders?.find(
    (o) =>
      o.driver_id === driver?.driver_id &&
      ["ASSIGNED", "PICKUP", "PICKED_UP", "IN_TRANSIT"].includes(o.status)
  );

  // Trigger browser alert reminder ONCE when order with saved instructions is in PICKUP
  useEffect(() => {
    if (
      activeOrder &&
      activeOrder.delivery_instructions &&
      (activeOrder.status === "PICKUP" || activeOrder.status === "PICKED_UP")
    ) {
      const storageKey = `fluxo_door_alert_shown_${activeOrder.order_id}`;
      if (!sessionStorage.getItem(storageKey)) {
        sessionStorage.setItem(storageKey, "true");
        setTimeout(() => {
          window.alert(
            `🔔 REACH-THE-DOOR REMINDER FOR DRIVER!\n\n` +
            `Location: ${activeOrder.location_id || "Assigned Address"}\n\n` +
            `Saved Instructions:\n"${activeOrder.delivery_instructions}"\n\n` +
            `Order: ${activeOrder.order_id}`
          );
        }, 150);
      }
    }
  }, [activeOrder]);

  async function handleSaveDriverInstructions() {
    if (!activeOrder || !driverNotesInput.trim()) return;

    setSavingInstructions(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      await orderApi.saveOrderInstructions(activeOrder.order_id, {
        doorInstructions: driverNotesInput.trim(),
        driverId: driver.driver_id,
      });

      setSaveSuccess("Saved to PostgreSQL! Any future driver delivering here will receive this reminder.");
      setDriverNotesInput("");
      if (onRefreshOrders) {
        await onRefreshOrders();
      }
    } catch (err) {
      setSaveError(
        err.response?.data?.message || err.message || "Failed to save door instructions."
      );
    } finally {
      setSavingInstructions(false);
    }
  }

  async function handleLookupLocation(e) {
    e?.preventDefault();
    if (!lookupLocId.trim()) return;
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const res = await orderApi.getLocationInstructions(lookupLocId.trim());
      if (res.data?.success && res.data?.data) {
        setLookupResult(res.data.data);
      } else {
        setLookupResult({ notFound: true });
      }
    } catch (err) {
      setLookupResult({ notFound: true, message: err.message });
    } finally {
      setLookupLoading(false);
    }
  }

  return (
    <section className="driver-portal">
      <div className="driver-portal-heading">
        <div className="driver-heading-row">
          <div>
            <span className="driver-portal-eyebrow">DRIVER WORKSPACE</span>
            <h2>Driver Portal</h2>
            <p>
              Share GPS coordinates, receive deliveries, and view reach-the-door instructions.
            </p>
          </div>

          {driver && (
            <button
              type="button"
              className="driver-switch-btn"
              onClick={() => {
                stopSharing();
                setDriver(null);
                driverRef.current = null;
                localStorage.removeItem("fluxo_active_driver_id");
                setMessage("Driver logged out. You can register a new driver below.");
              }}
            >
              Switch / Logout Driver
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="driver-portal-message error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="driver-portal-message success" role="status">
          {message}
        </div>
      )}

      {driver ? (
        <div className="driver-portal-layout">
          {/* ======================================================== */}
          {/* ACTIVE ASSIGNED DELIVERY & REACH-THE-DOOR CARD (FULL WIDTH) */}
          {/* ======================================================== */}
          <section className="driver-portal-card active-delivery-card">
            <div className="delivery-card-header">
              <div className="driver-portal-card-title">
                <Package size={20} />
                <h3>Current Assigned Delivery</h3>
              </div>

              {activeOrder && (
                <span className={`order-status-badge status-${activeOrder.status?.toLowerCase()}`}>
                  <span className="status-dot" />
                  {activeOrder.status}
                </span>
              )}
            </div>

            {activeOrder ? (
              <div className="active-order-details">
                <div className="order-metadata-row">
                  <div>
                    <span className="meta-label">Order ID</span>
                    <strong className="meta-value monospace">{activeOrder.order_id}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Customer ID</span>
                    <strong className="meta-value">{activeOrder.customer_id}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Destination Location ID</span>
                    <strong className="meta-value loc-pill">
                      📍 {activeOrder.location_id || "Standard Coords"}
                    </strong>
                  </div>
                </div>

                {/* POP-UP / PROMINENT ALERT BANNER FOR REACH-THE-DOOR INSTRUCTIONS */}
                {activeOrder.delivery_instructions ? (
                  <div className="reach-door-alert-banner">
                    <div className="door-alert-title-row">
                      <div className="door-alert-icon-title">
                        <Bell size={20} className="bell-alert-icon" />
                        <h4>REACH-THE-DOOR INSTRUCTIONS (Saved for this Address):</h4>
                      </div>
                      <span className="postgres-badge">PostgreSQL Verified</span>
                    </div>

                    <div className="door-instructions-box">
                      <p className="door-instructions-quote">
                        "{activeOrder.delivery_instructions}"
                      </p>
                    </div>

                    <div className="door-alert-footer">
                      <span>💡 This reminder is automatically triggered for any driver assigned to location ID: <code>{activeOrder.location_id}</code></span>
                    </div>
                  </div>
                ) : (
                  <div className="no-door-instructions-banner">
                    <Sparkles size={18} color="#a78bfa" />
                    <div>
                      <strong>First-time delivery to this address!</strong>
                      <p>No previous reach-the-door directions were recorded for this location ID yet.</p>
                    </div>
                  </div>
                )}

                {/* FORM FOR DRIVER TO ADD OR UPDATE DOOR DIRECTIONS */}
                <div className="driver-door-form">
                  <div className="door-form-header">
                    <KeyRound size={17} />
                    <strong>
                      {activeOrder.delivery_instructions
                        ? "Update Reach-the-Door Directions"
                        : "First time delivering here? Add Reach-the-Door Description"}
                    </strong>
                  </div>

                  <p className="door-form-desc">
                    Enter landmark or gate details (e.g. <em>"Use Gate B; entrance is behind the main road, 3rd floor"</em>). This is stored in PostgreSQL and will automatically pop up as an alert to any future driver assigned here!
                  </p>

                  <textarea
                    className="door-instructions-textarea"
                    value={driverNotesInput}
                    onChange={(e) => setDriverNotesInput(e.target.value)}
                    placeholder="e.g. Use Gate B; entrance is behind the main road, 3rd floor"
                    rows={3}
                  />

                  {saveSuccess && (
                    <div className="save-feedback success">
                      <CheckCircle2 size={16} />
                      <span>{saveSuccess}</span>
                    </div>
                  )}

                  {saveError && (
                    <div className="save-feedback error">
                      <span>{saveError}</span>
                    </div>
                  )}

                  <div className="door-form-actions">
                    <button
                      type="button"
                      className="save-door-btn"
                      onClick={handleSaveDriverInstructions}
                      disabled={savingInstructions || !driverNotesInput.trim()}
                    >
                      <Save size={16} />
                      {savingInstructions ? "Saving to Database..." : "Save Directions to PostgreSQL"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="no-active-order-state">
                <Package size={28} className="muted-icon" />
                <p>No active delivery assigned to this driver right now.</p>
                <span>Ensure your status is <strong>AVAILABLE</strong> and <strong>Share my location</strong> is ON to receive incoming orders automatically from Dispatch Service.</span>
              </div>
            )}
          </section>

          {/* ======================================================== */}
          {/* PROFILE & LOCATION SHARING GRID */}
          {/* ======================================================== */}
          <div className="driver-portal-grid">
            <section className="driver-portal-card">
              <div className="driver-portal-card-title">
                <UserPlus size={20} />
                <h3>Your profile</h3>
              </div>

              <div className="driver-portal-profile">
                <div className="driver-portal-avatar">
                  {driver.name?.charAt(0)?.toUpperCase() || "D"}
                </div>
                <div>
                  <strong>{driver.name}</strong>
                  <p>{driver.phone}</p>
                </div>
              </div>

              <div className="driver-portal-detail">
                <span>Driver ID</span>
                <strong className="monospace">{driver.driver_id}</strong>
              </div>

              <div className="driver-portal-detail">
                <span>Vehicle</span>
                <strong>{driver.vehicle_type || vehicleType}</strong>
              </div>

              <div className="driver-portal-detail">
                <span>Status</span>
                <strong className={`status-text ${driver.status?.toLowerCase()}`}>{driver.status}</strong>
              </div>

              <button
                className="driver-portal-secondary"
                onClick={toggleAvailability}
                disabled={busy}
              >
                <Power size={17} />
                {busy
                  ? "Updating..."
                  : driver.status === "AVAILABLE"
                    ? "Go offline"
                    : "Go available"}
              </button>
            </section>

            <section className="driver-portal-card">
              <div className="driver-portal-card-title">
                <MapPin size={20} />
                <h3>Location sharing</h3>
              </div>

              <div className="driver-portal-location-status">
                <span
                  className={`driver-portal-indicator ${sharing ? "online" : ""}`}
                />
                {sharing ? "Sharing location" : "Location not shared"}
              </div>

              {location && (
                <div className="driver-portal-coordinates">
                  <div>
                    <span>Latitude</span>
                    <strong>{location.latitude.toFixed(6)}</strong>
                  </div>
                  <div>
                    <span>Longitude</span>
                    <strong>{location.longitude.toFixed(6)}</strong>
                  </div>
                </div>
              )}

              <button
                className="driver-portal-primary"
                onClick={sharing ? stopSharing : startSharing}
              >
                <Radio size={17} />
                {sharing ? "Stop sharing" : "Share my location"}
              </button>

              <p className="driver-portal-help">
                Allow browser location access. While sharing is enabled, updates
                are sent periodically to keep your location fresh.
              </p>
            </section>
          </div>

          {/* ======================================================== */}
          {/* LOOKUP LOCATION INSTRUCTIONS CARD */}
          {/* ======================================================== */}
          <section className="driver-portal-card lookup-card">
            <div className="driver-portal-card-title">
              <KeyRound size={20} />
              <h3>Search Location Reach-The-Door Database</h3>
            </div>
            <p className="driver-portal-help">
              Check stored instructions for any Location ID in PostgreSQL:
            </p>

            <form className="lookup-form" onSubmit={handleLookupLocation}>
              <input
                value={lookupLocId}
                onChange={(e) => setLookupLocId(e.target.value)}
                placeholder="e.g. loc-vijayanagar-bengaluru or loc-koramangala-bengaluru"
              />
              <button type="submit" className="lookup-btn" disabled={lookupLoading || !lookupLocId.trim()}>
                {lookupLoading ? "Searching..." : "Lookup Directions"}
              </button>
            </form>

            {lookupResult && (
              <div className="lookup-result-box">
                {lookupResult.notFound ? (
                  <p className="lookup-not-found">No instructions stored yet for this location ID.</p>
                ) : (
                  <div>
                    <div className="lookup-result-header">
                      <strong>📍 {lookupResult.location_id}</strong>
                      <span className="source-tag">PostgreSQL Stored</span>
                    </div>
                    <p className="lookup-result-text">"{lookupResult.door_instructions}"</p>
                    {lookupResult.last_driver_id && (
                      <span className="lookup-meta">Last recorded by driver: {lookupResult.last_driver_id}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="driver-portal-card no-driver-banner">
          <UserPlus size={32} className="muted-icon" />
          <h3>No Active Driver Selected</h3>
          <p>
            Please register a new driver below to start location tracking and delivery operations.
          </p>
        </div>
      )}

      {/* ======================================================== */}
      {/* REGISTER NEW DRIVER (DOWNSIDE SECTION) */}
      {/* ======================================================== */}
      <section className="driver-portal-card register-driver-card">
        <div className="driver-portal-card-title">
          <UserPlus size={20} />
          <h3>Register as a new driver</h3>
        </div>
        <p className="driver-portal-help">
          Create and onboard a new driver profile with real-time dispatch eligibility.
        </p>

        <form className="register-driver-form" onSubmit={registerDriver}>
          <div className="register-form-grid">
            <label>
              Full name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter full name"
                required
              />
            </label>

            <label>
              Phone number
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Enter phone number"
                required
              />
            </label>

            <label>
              Vehicle type
              <select
                value={vehicleType}
                onChange={(event) => setVehicleType(event.target.value)}
              >
                <option value="BIKE">Bike</option>
                <option value="SCOOTER">Scooter</option>
                <option value="CAR">Car</option>
                <option value="VAN">Van</option>
              </select>
            </label>
          </div>

          <div className="register-form-actions">
            <button
              className="driver-portal-primary"
              type="submit"
              disabled={loading}
            >
              <UserPlus size={17} />
              {loading ? "Registering..." : "Register driver"}
            </button>
          </div>
        </form>
      </section>
    </section>
  );
}
