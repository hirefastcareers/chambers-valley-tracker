"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { initOneSignal, loginOneSignalUser } from "@/lib/onesignal";

export default function OneSignalInit() {
  const { userId, isLoaded } = useAuth();

  useEffect(() => {
    void initOneSignal().catch(() => {
      /* OneSignal optional; avoid unhandled rejection */
    });
  }, []);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    void loginOneSignalUser(userId).catch(() => {
      /* optional */
    });
  }, [isLoaded, userId]);

  return null;
}
