import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/** Next.js injects this as the real viewport meta — manual tags are ignored/overridden. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1e293b",
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
    <html lang="en" className={`${inter.variable} antialiased w-full overflow-x-hidden min-h-[100dvh]`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/patch-192.svg" />
        <link rel="manifest" href="/manifest.webmanifest?v=3" />
      </head>
      <body className="w-full flex flex-col font-sans text-[15px] leading-[1.5] text-[var(--color-text)] bg-[var(--color-bg)] overflow-x-hidden min-h-[100dvh]">
        <div className="flex min-h-[100dvh] flex-1 flex-col min-w-0 w-full">{children}</div>
      </body>
    </html>
  );
}
