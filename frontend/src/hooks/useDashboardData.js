import { useCallback, useEffect, useState } from "react";
import { orderApi, driverApi, locationApi } from "../services/api";

export default function useDashboardData() {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [locations, setLocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");

    try {
      const [ordersResult, driversResult] = await Promise.all([
        orderApi.getAll(),
        driverApi.getAll(),
      ]);

      const orderData = ordersResult.data.data;
      const driverData = driversResult.data.data;

      if (!Array.isArray(orderData) || !Array.isArray(driverData)) {
        throw new Error("Unexpected API response format");
      }

      setOrders(orderData);
      setDrivers(driverData);

      const locationResults = await Promise.allSettled(
        driverData.map(async (driver) => {
          const response = await locationApi.getByDriverId(
            driver.driver_id
          );

          return {
            driverId: driver.driver_id,
            location: response.data.data,
          };
        })
      );

      const nextLocations = {};

      for (const result of locationResults) {
        if (result.status === "fulfilled" && result.value.location) {
          nextLocations[result.value.driverId] = result.value.location;
        }
      }

      setLocations(nextLocations);
    } catch (err) {
      console.error("Dashboard data loading failed:", err);

      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load dashboard data"
      );
    } finally {
      setLoading(false);
    }
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