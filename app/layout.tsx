import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Saqr | AI-Powered GCC Compliance Platform",
  description: "AI-powered regulatory compliance inspections across GCC countries. Automated compliance verification with instant processing.",
  keywords: ["compliance", "inspection", "AI", "Bahrain", "GCC", "regulatory"],
  authors: [{ name: "Saqr" }],
  openGraph: {
    title: "Saqr | AI-Powered GCC Compliance Platform",
    description: "AI-powered regulatory compliance inspections across GCC countries.",
    url: "https://saqr.ai",
    siteName: "Saqr",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" dir="ltr">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}