import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/* Geist is not exported from next/font/google in this Next.js version; Inter matches the brief (400/600). */
const sans = Inter({
  variable: "--font-app",
  subsets: ["latin"],
  weight: ["400", "600"],
});

/** Next.js injects this as the real viewport meta — manual tags are ignored/overridden. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  title: "Patch — Job tracker",
  description: "Track jobs, follow-ups, photos, and earnings for your trade business.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  appleWebApp: {
    capable: true,
    title: "Patch",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} antialiased w-full overflow-x-hidden min-h-[100dvh]`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/patch-192.svg" />
        <link rel="manifest" href="/manifest.webmanifest?v=3" />
      </head>
      <body className="w-full flex flex-col font-sans text-[15px] leading-[1.5] font-normal text-[var(--c-text)] bg-[var(--c-bg)] overflow-x-hidden min-h-[100dvh]">
        <div className="flex min-h-[100dvh] flex-1 flex-col min-w-0 w-full">{children}</div>
      </body>
    </html>
  );
}
