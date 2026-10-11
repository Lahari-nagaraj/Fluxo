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
};

export const driverApi = {
  getAll: () => api.get("/drivers"),
  getAvailable: () => api.get("/drivers/available"),
  getById: (driverId) => api.get(`/drivers/${driverId}`),
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