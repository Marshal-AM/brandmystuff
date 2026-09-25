import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientRoot from "./client-root";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "brandmystuff — rent the ad space on your stuff",
  description: "List ad spaces on the things you own, get them scored by AI, lease them for USDC on Sui and tokenise their income. Every listing is an ENS name.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
