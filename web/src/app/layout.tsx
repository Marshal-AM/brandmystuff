import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ClientRoot from "./client-root";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "brandmystuff — your stuff is ad space",
  description:
    "List ad spaces on the things you own, get them scored by AI, lease them for USDC on Sui and tokenise their income. Every brand gets an AI agent that finds the spaces that fit it.",
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = { themeColor: "#0a0a0b" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
