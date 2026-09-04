import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import SwKayit from "@/components/SwKayit";
import KayitBildirimi from "@/components/KayitBildirimi";

export const metadata: Metadata = {
  title: "Denizlispor Sporcu Takip",
  description:
    "Denizlispor altyapı sporcuları için veli bilgilendirme ve aidat takip uygulaması",
  manifest: "/manifest.webmanifest",
  applicationName: "Denizlispor Sporcu Takip",
  appleWebApp: {
    capable: true,
    title: "Denizlispor",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#046a38",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <Suspense fallback={null}>
          <KayitBildirimi />
        </Suspense>
        <SwKayit />
      </body>
    </html>
  );
}
