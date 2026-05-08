import OneSignal from "react-onesignal";

export async function initOneSignal() {
  if (typeof window === "undefined") return;
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  if (!appId) return;

  await OneSignal.init({
    appId,
    safari_web_id: undefined,
    notifyButton: { enable: false },
    allowLocalhostAsSecureOrigin: true,
  } as unknown as Parameters<typeof OneSignal.init>[0]);
}
