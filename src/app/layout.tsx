import type { Metadata, Viewport } from "next";
import "./globals.css";
import SwKayit from "@/components/SwKayit";

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
      <body className="min-h-dvh antialiased">
        {children}
        <SwKayit />
      </body>
    </html>
  );
}
