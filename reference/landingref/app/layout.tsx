import type React from "react"
import type { Metadata, Viewport } from "next"
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", weight: ["400", "500", "600", "700", "800"] })
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", weight: ["400", "500", "600"] })

export const metadata: Metadata = {
  title: "brandmystuff — your stuff is ad space",
  description:
    "Turn the laptop, car, helmet or storefront you already own into ad space. Every brand gets an AI agent that finds the spaces that fit it and leases them in USDC on Sui, and you get paid when the ad is proven on display.",
  icons: { icon: "/brandmystuff-icon.svg" },
}

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${jetbrains.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
