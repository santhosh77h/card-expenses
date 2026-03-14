import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { siteConfig } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { Metadata, Viewport } from "next";
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
  title: `${siteConfig.name} | ${siteConfig.description}`,
  description:
    "Privacy-first credit card statement parser. Upload a PDF, get instant spending insights — no data ever stored on our servers. Supports 33+ banks across India, US, and UK.",
  keywords: siteConfig.keywords,
  openGraph: {
    title: `${siteConfig.name} — ${siteConfig.description}`,
    description:
      "Privacy-first credit card statement parser. Upload a PDF, get instant spending insights.",
    type: "website",
    locale: "en_US",
    siteName: siteConfig.name,
    url: siteConfig.url,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.description}`,
    description:
      "Privacy-first credit card statement parser. Upload a PDF, get instant spending insights.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: "/favicon.ico",
  metadataBase: new URL(siteConfig.url),
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          `${geistSans.variable} ${geistMono.variable}`,
          "min-h-screen bg-background antialiased w-full mx-auto scroll-smooth font-sans"
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
        >
          {children}
          <ThemeToggle />
        </ThemeProvider>
      </body>
    </html>
  );
}
