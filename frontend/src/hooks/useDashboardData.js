
import { useCallback, useEffect, useState } from "react";
import {
  orderApi,
  driverApi,
  locationApi,
} from "../services/api";

export default function useDashboardData() {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [locations, setLocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    const errors = [];

    // Load orders independently so a driver API failure
    // does not prevent orders from appearing.
    try {
      const response = await orderApi.getAll();
      const data = response.data?.data;

      if (!Array.isArray(data)) {
        throw new Error("Unexpected response format from GET /orders");
      }

      setOrders(data);
    } catch (err) {
      console.error("Orders API failed:", err);
      errors.push(
        `Orders API: ${
          err.response?.status
            ? `HTTP ${err.response.status}`
            : err.message
        }`
      );
    }

    // Load drivers independently and identify their exact error.
    try {
      const response = await driverApi.getAll();
      const data = response.data?.data;

      if (!Array.isArray(data)) {
        throw new Error("Unexpected response format from GET /drivers");
      }

      setDrivers(data);

      // Location lookups are optional: one failed lookup should
      // not break the dashboard.
      const results = await Promise.allSettled(
        data.map(async (driver) => {
          const response = await locationApi.getByDriverId(
            driver.driver_id
          );

          return {
            driverId: driver.driver_id,
            location: response.data?.data,
          };
        })
      );

      const nextLocations = {};

      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value.location) {
          nextLocations[result.value.driverId] = result.value.location;
        } else if (result.status === "rejected") {
          console.warn(
            `Location lookup failed for driver ${data[index].driver_id}:`,
            result.reason?.response?.status || result.reason?.message
          );
        }
      });

      setLocations(nextLocations);
    } catch (err) {
      console.error("Drivers API failed:", err);

      errors.push(
        `Drivers API: ${
          err.response?.status
            ? `HTTP ${err.response.status}`
            : err.message
        }`
      );
    }

    if (errors.length > 0) {
      setError(errors.join(" | "));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const applyLocationUpdate = useCallback((update) => {
    if (
      !update?.driverId ||
      !Number.isFinite(Number(update.latitude)) ||
      !Number.isFinite(Number(update.longitude))
    ) {
      return;
    }

    setLocations((current) => ({
      ...current,
      [update.driverId]: {
        driver_id: update.driverId,
        latitude: update.latitude,
        longitude: update.longitude,
        zone_id: update.zoneId,
        updated_at: update.updatedAt,
      },
    }));
  }, []);

  return {
    orders,
    drivers,
    locations,
    loading,
    error,
    refresh,
    applyLocationUpdate,
  };
}
