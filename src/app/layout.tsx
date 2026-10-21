import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/noto-sans-devanagari";
import "./globals.css";
import { AppProvider } from "@/lib/store/AppProvider";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = {
  title: "NetBhav — Farmer market decision support",
  description:
    "Compare where, when and how to sell produce by expected net realisation after transport, charges, losses and storage. Hackathon prototype with labelled demo data.",
};

export const viewport: Viewport = {
  themeColor: "#0d2d22",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
