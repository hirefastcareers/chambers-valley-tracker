import OneSignal from "react-onesignal";

let initPromise: Promise<boolean> | null = null;
let initSucceeded = false;

export async function initOneSignal(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim();
  if (!appId) {
    console.error("[OneSignal] NEXT_PUBLIC_ONESIGNAL_APP_ID is not set");
    return false;
  }

  if (initSucceeded) return true;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        await OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: true,
          notifyButton: { enable: false },
          serviceWorkerPath: "OneSignalSDKWorker.js",
        } as unknown as Parameters<typeof OneSignal.init>[0]);
        initSucceeded = true;
        console.log("[OneSignal] initialised successfully");
        return true;
      } catch (error) {
        initPromise = null;
        console.error("[OneSignal] init error:", error);
        return false;
      }
    })();
  }

  return initPromise;
}

export async function loginOneSignalUser(userId: string) {
  if (typeof window === "undefined" || !userId) return;

  const ready = await initOneSignal();
  if (!ready) {
    console.error("[OneSignal] cannot log in user — SDK not initialised");
    return;
  }

  try {
    await OneSignal.login(userId);
    console.log("[OneSignal] user logged in");
  } catch (error) {
    console.error("[OneSignal] login error:", error);
  }
}

export async function requestOneSignalPermission(): Promise<boolean> {
  const ready = await initOneSignal();
  if (!ready) {
    console.error("[OneSignal] cannot request permission — SDK not initialised");
    return false;
  }

  try {
    const granted = await OneSignal.Notifications.requestPermission();
    console.log("[OneSignal] permission result:", granted);
    return granted;
  } catch (error) {
    console.error("[OneSignal] requestPermission error:", error);
    return false;
  }
}
