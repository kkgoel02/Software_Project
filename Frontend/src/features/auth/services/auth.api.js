import axiosInstance from "../../../shared/utils/axiosInstance";

export const signup = (data) => axiosInstance.post("/auth/signup", data);
export const login = (data) => axiosInstance.post("/auth/login", data);
export const logout = () => axiosInstance.post("/auth/logout");
export const getMe = () => axiosInstance.get("/auth/me");