
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const orderApi = {
  getAll: () => api.get("/orders"),
  getById: (orderId) => api.get(`/orders/${orderId}`),
  create: (order) => api.post("/orders", order),
  getLocationInstructions: (locationId) =>
    api.get(`/orders/locations/${locationId}/instructions`),
  saveLocationInstructions: (locationId, data) =>
    api.post(`/orders/locations/${locationId}/instructions`, data),
  saveOrderInstructions: (orderId, data) =>
    api.post(`/orders/${orderId}/instructions`, data),
};

export const driverApi = {
  getAll: () => api.get("/drivers"),
  getAvailable: () => api.get("/drivers/available"),
  getById: (driverId) => api.get(`/drivers/${driverId}`),
  create: (driver) => api.post("/drivers", driver),
  updateStatus: (driverId, status) =>
    api.patch(`/drivers/${driverId}/status`, { status }),
};

export const locationApi = {
  getByDriverId: (driverId) =>
    api.get(`/locations/${driverId}`),

  getNearby: (latitude, longitude, radiusKm = 5) =>
    api.get("/locations/nearby", {
      params: { latitude, longitude, radiusKm },
    }),

  update: (location) => api.post("/locations", location),
};

export default api;
