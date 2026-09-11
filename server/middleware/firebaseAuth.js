import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const getFirebaseAuth = () => {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is required for authenticated API requests"
    );
  }
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const app =
    getApps()[0] ||
    initializeApp({
      credential: cert(serviceAccount),
    });
  return getAuth(app);
};

export const requireFirebaseUser = async (req, res, next) => {
  const authorization = req.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  if (!token) return res.status(401).json({ message: "Authentication required" });

  try {
    req.firebaseUser = await getFirebaseAuth().verifyIdToken(token);
    return next();
  } catch (error) {
    console.error("Firebase token verification failed:", error.message);
    return res.status(401).json({ message: "Invalid authentication token" });
  }
};
