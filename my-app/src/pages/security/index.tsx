import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axiosinstance";
import { auth } from "@/lib/firebase";
import { useUser } from "@/lib/AuthContext";

type SecurityResponse = {
  attempts: Array<{
    status: string;
    browser: string;
    operatingSystem: string;
    deviceType: string;
    ipAddress: string;
    createdAt: string;
  }>;
  devices: Array<{
    browser: string;
    operatingSystem: string;
    deviceType: string;
    ipAddress: string;
    expiresAt: string;
  }>;
};

export default function SecurityPage() {
  const { user } = useUser();
  const [security, setSecurity] = useState<SecurityResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadSecurity = async () => {
      if (!user || !auth.currentUser) return;
      try {
        const token = await auth.currentUser.getIdToken();
        const response = await axiosInstance.get("/security", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSecurity(response.data);
      } catch {
        setError("Unable to load account security history.");
      }
    };
    void loadSecurity();
  }, [user]);

  if (!user) return <main className="flex-1 p-6">Sign in to view security history.</main>;

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-2xl font-bold">Account security</h1>
        {error && <p className="text-destructive">{error}</p>}
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-lg font-semibold">Trusted devices</h2>
          {security?.devices.length ? (
            <ul className="space-y-2">
              {security.devices.map((device) => (
                <li key={`${device.browser}-${device.expiresAt}`} className="text-sm">
                  {device.browser} on {device.operatingSystem} ({device.deviceType}) -
                  trusted until {new Date(device.expiresAt).toLocaleDateString()}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No trusted devices found.</p>
          )}
        </section>
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-lg font-semibold">Recent login attempts</h2>
          {security?.attempts.length ? (
            <ul className="space-y-2">
              {security.attempts.map((attempt) => (
                <li key={`${attempt.createdAt}-${attempt.ipAddress}`} className="text-sm">
                  {attempt.status} - {attempt.browser} on {attempt.operatingSystem} -
                  {new Date(attempt.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No login attempts found.</p>
          )}
        </section>
      </div>
    </main>
  );
}
