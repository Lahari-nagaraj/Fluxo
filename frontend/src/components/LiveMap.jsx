import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

const BENGALURU = [12.9716, 77.5946];

function validCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export default function LiveMap({ drivers, locations, orders }) {
  const driverMarkers = drivers.flatMap((driver) => {
    const location = locations[driver.driver_id];

    if (!location || !validCoordinates(location.latitude, location.longitude)) {
      return [];
    }

    return [
      {
        id: driver.driver_id,
        name: driver.name,
        status: driver.status,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        zone: location.zone_id,
      },
    ];
  });

  const orderMarkers = orders.flatMap((order) => {
    if (!validCoordinates(order.pickup_latitude, order.pickup_longitude)) {
      return [];
    }

    return [
      {
        id: order.order_id,
        latitude: Number(order.pickup_latitude),
        longitude: Number(order.pickup_longitude),
        status: order.status,
      },
    ];
  });

  return (
    <section className="panel map-panel">
      <div className="panel-header">
        <div>
          <h3>Live delivery network</h3>
          <p>
            {driverMarkers.length} drivers with locations ·{" "}
            {orderMarkers.length} order pickups
          </p>
        </div>

        <span className="live-badge">
          <span className="status-dot" />
          MAP
        </span>
      </div>

      <div className="leaflet-map">
        <MapContainer
          center={BENGALURU}
          zoom={12}
          scrollWheelZoom
          className="leaflet-map-container"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {driverMarkers.map((driver) => (
            <CircleMarker
              key={driver.id}
              center={[driver.latitude, driver.longitude]}
              radius={8}
              pathOptions={{
                color: "#86efac",
                fillColor: "#22c55e",
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              <Tooltip>{driver.name || driver.id}</Tooltip>
              <Popup>
                <strong>{driver.name || driver.id}</strong>
                <br />
                Status: {driver.status || "Unknown"}
                <br />
                Zone: {driver.zone || "Unknown"}
                <br />
                {driver.latitude}, {driver.longitude}
              </Popup>
            </CircleMarker>
          ))}

          {orderMarkers.map((order) => (
            <CircleMarker
              key={order.id}
              center={[order.latitude, order.longitude]}
              radius={6}
              pathOptions={{
                color: "#c4b5fd",
                fillColor: "#8b5cf6",
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              <Popup>
                <strong>Order {order.id.slice(0, 8)}</strong>
                <br />
                Status: {order.status}
                <br />
                Pickup location
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div className="map-legend">
        <span>
          <i className="legend-driver" /> Drivers
        </span>
        <span>
          <i className="legend-order" /> Order pickups
        </span>
      </div>
    </section>
  );
}
