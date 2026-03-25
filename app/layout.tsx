import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: "400",
});

/** Next.js injects this as the real viewport meta — manual tags are ignored/overridden. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#2d6a4f",
};

export const metadata: Metadata = {
  title: "Chambers Valley Garden Care — Job Tracker",
  description: "Garden job tracker for scheduling follow-ups and tracking earnings.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  appleWebApp: {
    capable: true,
    title: "CV Garden Tracker",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${dmSerifDisplay.variable} antialiased w-full overflow-x-hidden`}
    >
      <head>
        <link rel="apple-touch-icon" href="/icons/leaf-192.svg" />
        <link rel="manifest" href="/manifest.webmanifest?v=2" />
      </head>
      <body className="w-full flex flex-col font-sans text-[15px] leading-relaxed text-[var(--color-text)] bg-[var(--color-surface)] overflow-x-hidden min-h-0">
        <div className="flex min-h-full flex-1 flex-col min-w-0 w-full">{children}</div>
      </body>
    </html>
  );
}
