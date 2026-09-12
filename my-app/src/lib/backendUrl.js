const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, "") ||
  "http://localhost:5000";

export const getBackendAssetUrl = (path) => {
  if (!path) return "";
  return `${backendUrl}/${String(path).replace(/^\/+/, "")}`;
};

export default backendUrl;
