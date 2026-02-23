import axios from "axios";

// create an axios instance to set baseURL with credentials to communicate with the backend

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_ENV === "production" ? import.meta.env.VITE_API_BASE_URL : "http://localhost:5050/api",
    withCredentials: true, // include cookies in requests for authentication
}); 

export default axiosInstance;