import type { Metadata, Viewport } from "next";
import { Battambang, Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthSync } from "@/components/layout/AuthSync";
import { ServiceWorkerRegister } from "@/components/layout/ServiceWorkerRegister";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const battambang = Battambang({
  variable: "--font-battambang",
  subsets: ["khmer"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Scholarship Selection Tracker",
  description: "NGO Education Partnership — Cambodia scholarship selection tracker",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sel. Tracker",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#004488",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${battambang.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          <AuthSync />
          <ServiceWorkerRegister />
          <OfflineBanner />
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
