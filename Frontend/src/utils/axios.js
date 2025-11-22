import axios from "axios";

const api = axios.create({
  baseURL: "https://citizens-3-7j4o.onrender.com/api",

  timeout: 5000,
  Port: 10000,
  withCredentials: true,  
});

export default api;
