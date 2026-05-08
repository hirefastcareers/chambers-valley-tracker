"use client";

import { useEffect } from "react";
import { initOneSignal } from "@/lib/onesignal";

export default function OneSignalInit() {
  useEffect(() => {
    void initOneSignal().catch(() => {
      /* OneSignal optional; avoid unhandled rejection */
    });
  }, []);

  return null;
}
