"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { initOneSignal, loginOneSignalUser } from "@/lib/onesignal";

export default function OneSignalInit() {
  const { userId, isLoaded } = useAuth();

  useEffect(() => {
    void initOneSignal();
  }, []);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    void loginOneSignalUser(userId);
  }, [isLoaded, userId]);

  return null;
}
