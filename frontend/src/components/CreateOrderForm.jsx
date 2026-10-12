import { useState, useEffect, useRef } from "react";
import {
  X,
  PackagePlus,
  MapPin,
  Navigation,
  LocateFixed,
  Route,
  Bell,
  Sparkles,
} from "lucide-react";
import {
  BENGALURU_LOCALITIES,
  searchLocalities,
  resolveAddressToCoordinates,
  calculateDistanceKm,
  getNearestLocality,
  toLocationId,
} from "../utils/locations";
import { orderApi } from "../services/api";
import "./CreateOrderForm.css";

const POPULAR_PICKUP_CHIPS = [
  "Vijayanagar",
  "Koramangala",
  "Indiranagar",
  "HSR Layout",
  "Whitefield",
  "MG Road",
];

const POPULAR_DELIVERY_CHIPS = [
  "Koramangala",
  "Indiranagar",
  "HSR Layout",
  "Jayanagar",
  "Whitefield",
  "Malleshwaram",
];

export default function CreateOrderForm({ onClose, onSubmit, submitting }) {
  const [customerId, setCustomerId] = useState(
    () => `customer-${Date.now().toString().slice(-4)}`
  );
  const [priority, setPriority] = useState("NORMAL");

  // Pickup Location State
  const [pickupArea, setPickupArea] = useState("Vijayanagar, Bengaluru");
  const [pickupStreet, setPickupStreet] = useState("");
  const [pickupCoords, setPickupCoords] = useState({
    latitude: 12.9719,
    longitude: 77.5304,
  });
  const [pickupIsLive, setPickupIsLive] = useState(false);
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [showPickupDropdown, setShowPickupDropdown] = useState(false);
  const [detectingPickupLive, setDetectingPickupLive] = useState(false);
  const [showManualPickup, setShowManualPickup] = useState(false);

  // Delivery Location State
  const [deliveryArea, setDeliveryArea] = useState("Koramangala, Bengaluru");
  const [deliveryStreet, setDeliveryStreet] = useState("");
  const [deliveryCoords, setDeliveryCoords] = useState({
    latitude: 12.9352,
    longitude: 77.6245,
  });
  const [deliverySuggestions, setDeliverySuggestions] = useState([]);
  const [showDeliveryDropdown, setShowDeliveryDropdown] = useState(false);
  const [showManualDelivery, setShowManualDelivery] = useState(false);

  const [formError, setFormError] = useState("");
  const pickupDebounce = useRef(null);
  const deliveryDebounce = useRef(null);

  // Location ID and Door Instructions State
  const [doorInstructions, setDoorInstructions] = useState("");
  const [savedInstructions, setSavedInstructions] = useState(null);
  const [loadingInstructions, setLoadingInstructions] = useState(false);
  const instructionsDebounce = useRef(null);

  const locationId = toLocationId(deliveryArea, deliveryStreet);

  // Check database for existing reach-the-door instructions for this location ID
  useEffect(() => {
    if (!locationId) {
      setSavedInstructions(null);
      return;
    }

    if (instructionsDebounce.current) clearTimeout(instructionsDebounce.current);
    instructionsDebounce.current = setTimeout(async () => {
      try {
        setLoadingInstructions(true);
        const res = await orderApi.getLocationInstructions(locationId);
        if (res.data?.success && res.data?.data) {
          setSavedInstructions(res.data.data);
          if (!doorInstructions) {
            setDoorInstructions(res.data.data.door_instructions || "");
          }
        } else {
          setSavedInstructions(null);
        }
      } catch {
        setSavedInstructions(null);
      } finally {
        setLoadingInstructions(false);
      }
    }, 400);

    return () => {
      if (instructionsDebounce.current) clearTimeout(instructionsDebounce.current);
    };
  }, [locationId]);

  // Calculate live route distance
  const routeDistance = calculateDistanceKm(
    Number(pickupCoords.latitude),
    Number(pickupCoords.longitude),
    Number(deliveryCoords.latitude),
    Number(deliveryCoords.longitude)
  );

  // Handle Pickup area input typing with debounced geocoding
  function handlePickupAreaChange(val) {
    setPickupArea(val);
    setPickupIsLive(false);

    const matches = searchLocalities(val);
    setPickupSuggestions(matches);
    setShowPickupDropdown(matches.length > 0);

    if (pickupDebounce.current) clearTimeout(pickupDebounce.current);
    pickupDebounce.current = setTimeout(async () => {
      if (val.trim()) {
        const resolved = await resolveAddressToCoordinates(val);
        setPickupCoords({
          latitude: resolved.latitude,
          longitude: resolved.longitude,
        });
      }
    }, 600);
  }

  // Handle Delivery area input typing with debounced geocoding
  function handleDeliveryAreaChange(val) {
    setDeliveryArea(val);

    const matches = searchLocalities(val);
    setDeliverySuggestions(matches);
    setShowDeliveryDropdown(matches.length > 0);

    if (deliveryDebounce.current) clearTimeout(deliveryDebounce.current);
    deliveryDebounce.current = setTimeout(async () => {
      if (val.trim()) {
        const resolved = await resolveAddressToCoordinates(val);
        setDeliveryCoords({
          latitude: resolved.latitude,
          longitude: resolved.longitude,
        });
      }
    }, 600);
  }

  // Select locality from suggestions or chip
  function selectPickupLocality(locality) {
    setPickupArea(locality.name);
    setPickupCoords({
      latitude: locality.latitude,
      longitude: locality.longitude,
    });
    setPickupIsLive(false);
    setShowPickupDropdown(false);
  }

  function selectDeliveryLocality(locality) {
    setDeliveryArea(locality.name);
    setDeliveryCoords({
      latitude: locality.latitude,
      longitude: locality.longitude,
    });
    setShowDeliveryDropdown(false);
  }

  // "Use my browser's live location" handler
  function handleUseLiveLocation() {
    if (!navigator.geolocation) {
      setFormError("Geolocation is not supported by your browser.");
      return;
    }

    setDetectingPickupLive(true);
    setFormError("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        const nearest = getNearestLocality(lat, lng);

        setPickupCoords({ latitude: lat, longitude: lng });
        setPickupArea(`Live Location (${nearest.displayName})`);
        setPickupIsLive(true);
        setDetectingPickupLive(false);
      },
      (err) => {
        setDetectingPickupLive(false);
        setFormError(
          `Could not detect live location: ${err.message}. Please select or enter an address.`
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    const pLat = Number(pickupCoords.latitude);
    const pLng = Number(pickupCoords.longitude);
    const dLat = Number(deliveryCoords.latitude);
    const dLng = Number(deliveryCoords.longitude);

    if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) {
      setFormError("Please select a valid pickup location.");
      return;
    }

    if (!Number.isFinite(dLat) || !Number.isFinite(dLng)) {
      setFormError("Please select a valid delivery location.");
      return;
    }

    // Prepare payload matching backend Order Service exactly
    const payload = {
      customerId: customerId.trim() || `customer-${Date.now().toString().slice(-4)}`,
      pickupLatitude: pLat,
      pickupLongitude: pLng,
      deliveryLatitude: dLat,
      deliveryLongitude: dLng,
      priority,
      locationId: locationId || undefined,
      addressName: deliveryArea.trim(),
      streetAddress: deliveryStreet.trim() || undefined,
      deliveryInstructions: doorInstructions.trim() || (savedInstructions?.door_instructions || undefined),
    };

    try {
      await onSubmit(payload);
    } catch (error) {
      setFormError(error.message || "Could not create the order.");
    }
  }

  return (
    <section className="panel create-order-panel">
      <div className="panel-header">
        <div className="create-order-heading">
          <div className="create-order-icon">
            <PackagePlus size={22} />
          </div>
          <div>
            <h3>Create Delivery Order</h3>
            <p>Enter pickup & delivery addresses. Coordinates are automatically mapped.</p>
          </div>
        </div>

        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close order form"
        >
          <X size={18} />
        </button>
      </div>

      <form className="create-order-form" onSubmit={handleSubmit}>
        {/* Customer ID */}
        <label className="form-field full-width">
          <span>Customer ID</span>
          <input
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder="e.g. customer-vijay-101"
            maxLength={100}
            required
          />
        </label>

        {/* ======================================================== */}
        {/* PICKUP LOCATION CARD */}
        {/* ======================================================== */}
        <div className="location-card">
          <div className="location-card-header">
            <div className="location-card-title">
              <MapPin size={17} className="title-icon" />
              <span>Pickup Location</span>
              {pickupIsLive && (
                <span className="live-badge">
                  <span className="live-badge-dot" />
                  Live GPS
                </span>
              )}
            </div>

            <button
              type="button"
              className={`live-location-btn ${pickupIsLive ? "active" : ""}`}
              onClick={handleUseLiveLocation}
              disabled={detectingPickupLive}
              title="Use my browser's live GPS location"
            >
              <LocateFixed size={13} />
              {detectingPickupLive ? "Detecting…" : "Use live location"}
            </button>
          </div>

          {/* Quick chips */}
          <div className="quick-chips-row">
            <span className="quick-chips-label">Popular:</span>
            {POPULAR_PICKUP_CHIPS.map((chipName) => {
              const loc = BENGALURU_LOCALITIES.find(
                (l) => l.displayName === chipName
              );
              const isSelected = pickupArea.toLowerCase().includes(chipName.toLowerCase());
              return (
                <button
                  key={chipName}
                  type="button"
                  className={`chip-btn ${isSelected ? "selected" : ""}`}
                  onClick={() => loc && selectPickupLocality(loc)}
                >
                  {chipName}
                </button>
              );
            })}
          </div>

          {/* Address / Area input with suggestions */}
          <div className="input-with-suggestions">
            <label className="form-field">
              <span>Area / Locality</span>
              <input
                value={pickupArea}
                onChange={(e) => handlePickupAreaChange(e.target.value)}
                onFocus={() => {
                  const m = searchLocalities(pickupArea);
                  setPickupSuggestions(m);
                  setShowPickupDropdown(m.length > 0);
                }}
                placeholder="e.g. Vijayanagar, Bengaluru"
                required
              />
            </label>

            {showPickupDropdown && pickupSuggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {pickupSuggestions.map((loc) => (
                  <div
                    key={loc.name}
                    className="suggestion-item"
                    onMouseDown={() => selectPickupLocality(loc)}
                  >
                    <span>{loc.name}</span>
                    <span className="suggestion-coords">
                      {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Optional Street Address */}
          <label className="form-field">
            <span>Street / Door No. / Landmark (Optional)</span>
            <input
              value={pickupStreet}
              onChange={(e) => setPickupStreet(e.target.value)}
              placeholder="e.g. 5th Main Rd, Near Vijayanagar Metro Station"
            />
          </label>

          {/* Resolved Coordinates Badge & Toggle */}
          <div className="coord-badge">
            <span>
              Mapped GPS: <strong>{pickupCoords.latitude}, {pickupCoords.longitude}</strong>
            </span>
            <button
              type="button"
              className="toggle-coords-btn"
              onClick={() => setShowManualPickup((curr) => !curr)}
            >
              {showManualPickup ? "Hide coords" : "Edit coords"}
            </button>
          </div>

          {showManualPickup && (
            <div className="manual-coords-grid">
              <label>
                Latitude
                <input
                  type="number"
                  step="any"
                  value={pickupCoords.latitude}
                  onChange={(e) =>
                    setPickupCoords((c) => ({ ...c, latitude: e.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Longitude
                <input
                  type="number"
                  step="any"
                  value={pickupCoords.longitude}
                  onChange={(e) =>
                    setPickupCoords((c) => ({ ...c, longitude: e.target.value }))
                  }
                  required
                />
              </label>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* DELIVERY LOCATION CARD */}
        {/* ======================================================== */}
        <div className="location-card">
          <div className="location-card-header">
            <div className="location-card-title delivery">
              <Navigation size={17} className="title-icon" />
              <span>Delivery Location</span>
            </div>
          </div>

          {/* Quick chips */}
          <div className="quick-chips-row">
            <span className="quick-chips-label">Popular:</span>
            {POPULAR_DELIVERY_CHIPS.map((chipName) => {
              const loc = BENGALURU_LOCALITIES.find(
                (l) => l.displayName === chipName
              );
              const isSelected = deliveryArea.toLowerCase().includes(chipName.toLowerCase());
              return (
                <button
                  key={chipName}
                  type="button"
                  className={`chip-btn ${isSelected ? "selected" : ""}`}
                  onClick={() => loc && selectDeliveryLocality(loc)}
                >
                  {chipName}
                </button>
              );
            })}
          </div>

          {/* Address / Area input with suggestions */}
          <div className="input-with-suggestions">
            <label className="form-field">
              <span>Area / Locality</span>
              <input
                value={deliveryArea}
                onChange={(e) => handleDeliveryAreaChange(e.target.value)}
                onFocus={() => {
                  const m = searchLocalities(deliveryArea);
                  setDeliverySuggestions(m);
                  setShowDeliveryDropdown(m.length > 0);
                }}
                placeholder="e.g. Koramangala, Bengaluru"
                required
              />
            </label>

            {showDeliveryDropdown && deliverySuggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {deliverySuggestions.map((loc) => (
                  <div
                    key={loc.name}
                    className="suggestion-item"
                    onMouseDown={() => selectDeliveryLocality(loc)}
                  >
                    <span>{loc.name}</span>
                    <span className="suggestion-coords">
                      {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Optional Street Address */}
          <label className="form-field">
            <span>Street / Door No. / Landmark (Optional)</span>
            <input
              value={deliveryStreet}
              onChange={(e) => setDeliveryStreet(e.target.value)}
              placeholder="e.g. 80ft Road, Sony World Signal"
            />
          </label>

          {/* Resolved Coordinates Badge & Toggle */}
          <div className="coord-badge">
            <span>
              Mapped GPS: <strong>{deliveryCoords.latitude}, {deliveryCoords.longitude}</strong>
            </span>
            <button
              type="button"
              className="toggle-coords-btn"
              onClick={() => setShowManualDelivery((curr) => !curr)}
            >
              {showManualDelivery ? "Hide coords" : "Edit coords"}
            </button>
          </div>

          {showManualDelivery && (
            <div className="manual-coords-grid">
              <label>
                Latitude
                <input
                  type="number"
                  step="any"
                  value={deliveryCoords.latitude}
                  onChange={(e) =>
                    setDeliveryCoords((c) => ({ ...c, latitude: e.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Longitude
                <input
                  type="number"
                  step="any"
                  value={deliveryCoords.longitude}
                  onChange={(e) =>
                    setDeliveryCoords((c) => ({ ...c, longitude: e.target.value }))
                  }
                  required
                />
              </label>
            </div>
          )}

          {/* Location ID Identifier */}
          <div className="location-id-badge">
            <span className="location-id-label">📍 Destination Location ID:</span>
            <code className="location-id-code">{locationId}</code>
          </div>

          {/* Saved Reach-The-Door Instructions Alert or First-time Notice */}
          {savedInstructions ? (
            <div className="saved-door-alert">
              <div className="saved-door-alert-header">
                <Bell size={15} className="bell-icon" />
                <strong>Stored Reach-the-Door Directions Found</strong>
                <span className="source-tag">PostgreSQL Cached</span>
              </div>
              <p className="saved-door-content">
                "{savedInstructions.door_instructions}"
              </p>
              <div className="saved-door-meta">
                <span>Location: {savedInstructions.location_id}</span>
                {savedInstructions.last_driver_id && (
                  <span> · Saved by Driver: {savedInstructions.last_driver_id}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="first-time-location-info">
              <Sparkles size={14} />
              <span>
                New delivery address. Driver can record reach-the-door directions upon arrival.
              </span>
            </div>
          )}

          {/* Reach-The-Door Description / Notes Input */}
          <label className="form-field">
            <span>
              Reach-the-door description / notes {savedInstructions ? "(Edit or keep existing)" : "(Optional)"}
            </span>
            <input
              value={doorInstructions}
              onChange={(e) => setDoorInstructions(e.target.value)}
              placeholder="e.g. Use Gate B; entrance is behind the main road, 3rd floor"
            />
            <span className="field-hint">
              This note automatically alerts whichever driver is assigned to deliver here.
            </span>
          </label>
        </div>

        {/* Route Summary & Estimated Distance */}
        <div className="route-summary-bar">
          <div className="route-summary-info">
            <Route size={18} color="#a78bfa" />
            <span>
              <strong>Estimated Route:</strong> {pickupArea} → {deliveryArea}
            </span>
          </div>
          <div className="route-distance-pill">
            ~{routeDistance.toFixed(2)} km
          </div>
        </div>

        {/* Priority */}
        <label className="form-field full-width">
          <span>Delivery Priority</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="NORMAL">Normal Priority</option>
            <option value="HIGH">High Priority</option>
            <option value="URGENT">Urgent Priority</option>
          </select>
        </label>

        {formError && (
          <p className="inline-error full-width" role="alert">
            {formError}
          </p>
        )}

        <div className="form-actions full-width">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={submitting}
          >
            {submitting ? "Creating Order…" : "Create Order"}
          </button>
        </div>
      </form>
    </section>
  );
}
