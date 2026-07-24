import OneSignal from "react-onesignal";

let initPromise: Promise<void> | null = null;

export async function initOneSignal() {
  if (typeof window === "undefined") return;
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  if (!appId) return;

  if (!initPromise) {
    initPromise = OneSignal.init({
      appId,
      safari_web_id: undefined,
      notifyButton: { enable: false },
      allowLocalhostAsSecureOrigin: true,
    } as unknown as Parameters<typeof OneSignal.init>[0]).then(() => undefined);
  }

  await initPromise;
}

export async function loginOneSignalUser(userId: string) {
  if (typeof window === "undefined" || !userId) return;
  await initOneSignal();
  await OneSignal.login(userId);
}
