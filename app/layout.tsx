import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pislaka Agent",
  description: "AI workspace for real estate brokers in Pakistan"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
