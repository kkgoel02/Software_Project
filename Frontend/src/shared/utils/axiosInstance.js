import axios from "axios";

/**
 * Central axios instance pointed at the backend API.
 * Automatically attaches the stored JWT (if any) to every outgoing request, so individual feature api.js files don't need to handle auth headers themselves.
 */

const axiosInstance = axios.create({
  baseURL: "http://localhost:5000/api",
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosInstance;
