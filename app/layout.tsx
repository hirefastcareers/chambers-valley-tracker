import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Chambers Valley Garden Care — Job Tracker",
  description: "Garden job tracker for scheduling follow-ups and tracking earnings.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${dmSerifDisplay.variable} h-full antialiased w-full overflow-x-hidden`}
    >
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#2d6a4f" />
        <link rel="apple-touch-icon" href="/icons/leaf-192.svg" />
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body className="min-h-full w-full flex flex-col font-sans text-[15px] leading-relaxed text-[var(--color-text)] bg-[var(--color-surface)] overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
