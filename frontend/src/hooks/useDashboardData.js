
import { useCallback, useEffect, useRef, useState } from "react";
import {
  orderApi,
  driverApi,
  locationApi,
  dispatchApi,
} from "../services/api";

export default function useDashboardData() {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [locations, setLocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isInitialMount = useRef(true);

  const refresh = useCallback(async () => {
    if (isInitialMount.current) {
      setLoading(true);
    }
    setError("");

    const errors = [];

    // Load orders and active assignments in parallel
    try {
      const [orderRes, assignmentRes] = await Promise.allSettled([
        orderApi.getAll(),
        dispatchApi.getAssignments(),
      ]);

      let orderData = [];
      if (orderRes.status === "fulfilled") {
        orderData = orderRes.value.data?.data || [];
      } else {
        throw orderRes.reason;
      }

      // Map active assignments to orders if order.driver_id is not already populated
      let assignmentMap = {};
      if (assignmentRes.status === "fulfilled" && Array.isArray(assignmentRes.value.data?.data)) {
        for (const a of assignmentRes.value.data.data) {
          if (a.orderId) {
            assignmentMap[a.orderId] = a;
          }
        }
      }

      const mergedOrders = orderData.map((order) => {
        const activeAssignment = assignmentMap[order.order_id];
        if (activeAssignment && (!order.driver_id || order.driver_id === "")) {
          return {
            ...order,
            driver_id: activeAssignment.driverId,
            assigned_at: activeAssignment.assignedAt || order.updated_at,
          };
        }
        return order;
      });

      setOrders(mergedOrders);
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

    // Load drivers independently
    try {
      const response = await driverApi.getAll();
      const data = response.data?.data;

      if (!Array.isArray(data)) {
        throw new Error("Unexpected response format from GET /drivers");
      }

      setDrivers(data);

      // Location lookups are optional
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
    isInitialMount.current = false;
  }, []);

  useEffect(() => {
    refresh();

    // Auto-refresh every 4 seconds so orders progress dynamically across states
    const timer = setInterval(() => {
      refresh();
    }, 4000);

    return () => clearInterval(timer);
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
