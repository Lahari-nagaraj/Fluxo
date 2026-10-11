import { useEffect, useRef, useState } from "react";
import { MapPin, UserPlus, Radio, Power } from "lucide-react";
import { driverApi, locationApi } from "../services/api";
import "./DriverPortal.css";

export default function DriverPortal() {
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
      setMessage("Registration successful. Share your location to continue.");
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

  return (
    <section className="driver-portal">
      <div className="driver-portal-heading">
        <div>
          <span className="driver-portal-eyebrow">DRIVER WORKSPACE</span>
          <h2>Driver Portal</h2>
          <p>
            Register, share your GPS location, and manage your availability.
          </p>
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

      {!driver ? (
        <form className="driver-portal-card" onSubmit={registerDriver}>
          <div className="driver-portal-card-title">
            <UserPlus size={20} />
            <h3>Register as a driver</h3>
          </div>

          <label>
            Full name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your name"
              required
            />
          </label>

          <label>
            Phone number
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Enter your phone number"
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

          <button
            className="driver-portal-primary"
            type="submit"
            disabled={loading}
          >
            <UserPlus size={17} />
            {loading ? "Registering..." : "Register driver"}
          </button>
        </form>
      ) : (
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
              <strong>{driver.driver_id}</strong>
            </div>

            <div className="driver-portal-detail">
              <span>Vehicle</span>
              <strong>{driver.vehicle_type || vehicleType}</strong>
            </div>

            <div className="driver-portal-detail">
              <span>Status</span>
              <strong>{driver.status}</strong>
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
      )}
    </section>
  );
}
