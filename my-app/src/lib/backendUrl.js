const directBackendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, "") ||
  "http://localhost:5000";

// Browser uses same-origin /backend (Next rewrite) to avoid CORS failures.
// Server-side code can call the backend directly.
const backendUrl =
  typeof window === "undefined" ? directBackendUrl : "/backend";

export const getBackendAssetUrl = (path) => {
  if (!path) return "";
  return `${backendUrl}/${String(path).replace(/^\/+/, "")}`;
};

export const getSocketBackendUrl = () => directBackendUrl;

export default backendUrl;
