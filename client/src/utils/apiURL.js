// Remove trailing slash from base URL
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"
).replace(/\/$/, "");

//use VITE_BASE_URL if its set, if not then use http://localhost:3000
export const apiUrl = function (path) {
  return API_BASE_URL + path;
};
