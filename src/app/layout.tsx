import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "FinanceIQ - AI Bank Statement Analyzer",
  description:
    "Analyze PDF, CSV, and XLSX bank statements with AI-powered spending insights, subscriptions, forecasts, charts, and exportable financial reports.",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "FinanceIQ - AI Bank Statement Analyzer",
    description:
      "Analyze PDF, CSV, and XLSX bank statements with AI-powered spending insights, subscriptions, forecasts, charts, and exportable financial reports.",
    url: "/",
    siteName: "FinanceIQ",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FinanceIQ - AI Bank Statement Analyzer",
    description:
      "Analyze PDF, CSV, and XLSX bank statements with AI-powered spending insights, subscriptions, forecasts, charts, and exportable financial reports.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
