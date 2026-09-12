import axios from "axios";
import backendUrl from "./backendUrl";

const axiosInstance = axios.create({
  baseURL: backendUrl,
});

export default axiosInstance;
