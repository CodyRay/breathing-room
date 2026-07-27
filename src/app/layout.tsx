import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Breathing Room",
  applicationName: "Breathing Room",
  description:
    "Practise square breathing, 4-7-8 and other paced patterns with audio cues.",
  // iOS ignores the web manifest for standalone mode and uses these instead.
  appleWebApp: {
    capable: true,
    title: "Breathing",
    statusBarStyle: "black-translucent",
  },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <head>
        {/*
          Chrome fires beforeinstallprompt while the page is loading, which can
          be before React has hydrated — a listener added in an effect misses it
          and the install option never appears. Stash it here during HTML parse
          and let the hook read it back. See useInstall.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
  window.__installPrompt=null;window.__installed=false;
  function n(){window.dispatchEvent(new Event("installstatechange"))}
  window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__installPrompt=e;n()});
  window.addEventListener("appinstalled",function(){window.__installed=true;window.__installPrompt=null;n()});
})();`,
          }}
        />
      </head>
      <body className="min-h-full">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
