import crypto from "crypto";

export const parseDevice = (userAgent = "") => {
  const browser = /Edg\/([\d.]+)/.test(userAgent)
    ? `Edge ${userAgent.match(/Edg\/([\d.]+)/)[1]}`
    : /Chrome\/([\d.]+)/.test(userAgent)
      ? `Chrome ${userAgent.match(/Chrome\/([\d.]+)/)[1]}`
      : /Firefox\/([\d.]+)/.test(userAgent)
        ? `Firefox ${userAgent.match(/Firefox\/([\d.]+)/)[1]}`
        : /Safari\/([\d.]+)/.test(userAgent)
          ? "Safari"
          : "Unknown";
  const operatingSystem = /Windows/.test(userAgent)
    ? "Windows"
    : /Mac OS/.test(userAgent)
      ? "macOS"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad/.test(userAgent)
          ? "iOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "Unknown";
  const deviceType = /Tablet|iPad/.test(userAgent)
    ? "Tablet"
    : /Mobile|Android|iPhone/.test(userAgent)
      ? "Mobile"
      : "Desktop";
  const fingerprint = crypto
    .createHash("sha256")
    .update(`${browser}|${operatingSystem}|${deviceType}`)
    .digest("hex");
  return { browser, operatingSystem, deviceType, deviceModel: "Unknown", fingerprint };
};
