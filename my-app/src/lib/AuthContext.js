import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { useRef, useState } from "react";
import { createContext } from "react";
import { provider, auth } from "./firebase";
import axiosInstance from "./axiosinstance";
import { useEffect, useContext } from "react";
import { useTheme } from "next-themes";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const loginInProgress = useRef(false);
  const { setTheme } = useTheme();

  const getIstTheme = () => {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        hour12: false,
      }).format(new Date())
    );
    return hour >= 5 && hour < 12 ? "light" : "dark";
  };

  const applyUserTheme = async (userdata) => {
    const selectedTheme = userdata.themePreference || getIstTheme();
    setTheme(selectedTheme);

    if (!userdata.themePreference && userdata._id) {
      try {
        await axiosInstance.patch(`/user/update/${userdata._id}`, {
          themePreference: selectedTheme,
        });
      } catch (error) {
        console.error("Unable to save automatic theme preference:", error);
      }
    }
  };

  const login = async (userdata) => {
    setUser(userdata);
    localStorage.setItem("user", JSON.stringify(userdata));
    await applyUserTheme(userdata);
  };
  const logout = async () => {
    setUser(null);
    localStorage.removeItem("user");
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error during sign out:", error);
    }
  };
  const updateTheme = async (nextTheme) => {
    setTheme(nextTheme);
    if (!user?._id) return;

    const updatedUser = { ...user, themePreference: nextTheme };
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
    await axiosInstance.patch(`/user/update/${user._id}`, {
      themePreference: nextTheme,
    });
  };
  const handlegooglesignin = async () => {
    if (loginInProgress.current) return;
    loginInProgress.current = true;
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseuser = result.user;
      const idToken = await firebaseuser.getIdToken();
      const payload = {
        idToken,
      };
      const response = await axiosInstance.post("/security/login", payload, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (response.data.requiresOtp) {
        const code = window.prompt(
          "Enter the 6-digit development OTP shown in the backend terminal"
        );
        if (!code) return;
        const verified = await axiosInstance.post("/security/verify-otp", {
          attemptId: response.data.attemptId,
          code,
        });
        await login(verified.data.result);
      } else {
        await login(response.data.result);
      }
    } catch (error) {
      console.error(error);
    } finally {
      loginInProgress.current = false;
    }
  };
  useEffect(() => {
    const unsubcribe = onAuthStateChanged(auth, async (firebaseuser) => {
      if (firebaseuser && !loginInProgress.current) {
        try {
          const payload = {
            idToken: await firebaseuser.getIdToken(),
          };
          const response = await axiosInstance.post("/security/login", payload, {
            headers: { Authorization: `Bearer ${payload.idToken}` },
          });
          if (response.data.requiresOtp) return;
          await login(response.data.result);
        } catch (error) {
          console.error(error);
          logout();
        }
      }
    });
    return () => unsubcribe();
  }, []);

  return (
    <UserContext.Provider
      value={{ user, login, logout, updateTheme, handlegooglesignin }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
