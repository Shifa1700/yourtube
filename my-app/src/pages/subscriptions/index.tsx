import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axiosinstance";
import { useUser } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import Script from "next/script";
import { auth } from "@/lib/firebase";

type Plans = Record<
  string,
  { monthly: number; dailyDownloads: number; quality: string; premium: boolean }
>;

type RazorpayCheckout = new (options: {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal: { ondismiss: () => void };
}) => { open: () => void };

declare global {
  interface Window {
    Razorpay?: RazorpayCheckout;
  }
}

export default function SubscriptionsPage() {
  const { user } = useUser();
  const [plans, setPlans] = useState<Plans>({});
  const [current, setCurrent] = useState<any>(null);
  const [error, setError] = useState("");
  const [loadingPlan, setLoadingPlan] = useState("");

  useEffect(() => {
    axiosInstance
      .get("/subscription/plans")
      .then((response) => setPlans(response.data))
      .catch(() => setError("Unable to load subscription plans."));
    if (user?._id && auth.currentUser) {
      const loadSubscription = async () => {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const response = await axiosInstance.get("/subscription/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCurrent(response.data);
      };
      loadSubscription().catch(() =>
        setError("Unable to load your subscription.")
      );
    }
  }, [user]);

  const subscribe = async (plan: string) => {
    if (!auth.currentUser || !window.Razorpay) {
      setError("Payment checkout is not configured yet.");
      return;
    }
    setError("");
    setLoadingPlan(plan);
    try {
      const token = await auth.currentUser.getIdToken();
      const orderResponse = await axiosInstance.post(
        "/subscription/order",
        { plan, billingPeriod: "monthly" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const order = orderResponse.data;
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "YourTube",
        description: `${plan} subscription`,
        order_id: order.orderId,
        handler: async (payment) => {
          try {
            await axiosInstance.post(
              "/subscription/verify",
              {
                plan,
                billingPeriod: "monthly",
                ...payment,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            window.location.reload();
          } catch (verificationError) {
            console.error("Subscription verification failed:", verificationError);
            setError(
              "Payment succeeded, but subscription verification failed. Check the backend terminal."
            );
            setLoadingPlan("");
          }
        },
        modal: { ondismiss: () => setLoadingPlan("") },
      });
      checkout.open();
    } catch (requestError) {
      console.error(requestError);
      setError("Payment could not be started.");
      setLoadingPlan("");
    }
  };

  return (
    <main className="flex-1 p-6">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Subscriptions</h1>
          <p className="app-muted mt-1">
            Compare plans and see your current download entitlement.
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {current && (
          <div className="app-surface rounded-lg border p-4">
            Current plan: <strong>{current.plan}</strong>
            {current.expiresAt && (
              <span className="app-muted ml-2">
                expires {new Date(current.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(plans).map(([name, plan]) => (
            <div key={name} className="app-surface rounded-lg border p-5">
              <h2 className="text-lg font-semibold">{name}</h2>
              <p className="mt-2 text-2xl font-bold">
                {plan.monthly === 0 ? "Free" : `₹${plan.monthly}/mo`}
              </p>
              <ul className="app-muted mt-4 space-y-2 text-sm">
                <li>{plan.dailyDownloads} downloads/day</li>
                <li>Up to {plan.quality}</li>
                <li>{plan.premium ? "Premium access" : "Standard access"}</li>
              </ul>
              <Button
                className="mt-5 w-full"
                disabled={!user || name === "Free" || loadingPlan !== ""}
                onClick={() => void subscribe(name)}
              >
                {name === "Free"
                  ? "Included"
                  : loadingPlan === name
                    ? "Opening checkout..."
                    : "Subscribe"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
