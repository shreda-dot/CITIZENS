import axios from "axios";

const api = axios.create({
  baseURL: "https://your-backend-url.onrender.com/api", // Replace with your backend URL
  timeout: 5000,
});

export default api;
