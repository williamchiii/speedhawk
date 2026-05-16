const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

//use VITE_BASE_URL if its set, if not then use http://localhost:3000
export const apiUrl = (path) => `${API_BASE_URL}${path}`;
