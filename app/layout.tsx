import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import Script from "next/script";
import AppBar from "@/components/AppBar/AppBar";
import ThemeProvider from "@/components/ThemeProvider/ThemeProvider";
import Footer from "@/components/Footer/Footer";
import ScrollToTop from "@/components/ScrollToTop/ScrollToTop";
import { CurrencyProvider } from "@/contexts/currency";
import { AuthProvider } from "@/contexts/authContext";
import CanonicalTag from "@/components/System/CanonicalTag/CanonicalTag";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const viewport = {
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "MoneyReload - SIP, Mortgage, FD, CD, Loan & Financial Calculators",
  description:
    "Free financial tools like SIP calculator, mortgage calculator, personal loan calculator, certificate of deposit (CD) calculator, and income tax estimator for users in the all over the world including US, UK, and EU.",
  keywords:
    "MoneyReload, Money Reload, SIP Calculator, Mortgage Calculator, Loan Calculator, CD Calculator, Certificate of Deposit, Income Tax Estimator, Mutual Fund, ETF, Index Fund, Financial Tools, US Finance, UK Finance, EU Finance, Investment Calculators",
  authors: [{ name: "Pradeep Jadhav" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    title: "MoneyReload",
    siteName: "MoneyReload",
    url: process.env.PROD_URL,
    images: [`${process.env.PROD_URL}/thumbnail.webp`],
    description:
      "Finance tools like SIP, mortgage, loan, tax, FD and CD calculators to optimize personal investments for all countries the US, UK, and EU.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MoneyReload - SIP, Mortgage, CDs, Loans, Tax Tools",
    images: [`${process.env.PROD_URL}/thumbnail.webp`],
    description:
      "Free investment and tax planning calculators for SIPs, mortgages, CD, loans, FD, RD and more.",
  },
  other: {
    "google-adsense-account": "ca-pub-8297185763828699",
  },
  alternates: {
    canonical: process.env.PROD_URL,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.className}`}>
      <head>
        {/* Google Analytics */}
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-GWRNM1EMVX"
        ></Script>
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag() { dataLayer.push(arguments); }
              gtag('js', new Date());
              gtag('config', 'G-GWRNM1EMVX');
            `,
          }}
        />

        {/* Google Adsense */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8297185763828699"
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />

        {/* Canonical URL */}
        <CanonicalTag />

        {/* Web Manifest */}
        <link rel="manifest" href="/manifest.json" />

        <link rel="icon" href="/favicon-v2.ico" />
        <link rel="shortcut icon" href="/favicon-v2.ico" />

        {/* JSON-LD Schema */}
        <Script
          id="json-ld-website"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "MoneyReload",
              url: process.env.PROD_URL,
              alternateName: ["Money Reload"],
            }),
          }}
        />

        <Script
          id="json-ld-webpage"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebPage",
              name: "MoneyReload",
              alternateName: ["Money Reload"],
              description:
                "Free online finance calculators for SIPs, mortgages, loans, CDs (Certificates of Deposit), and income tax planning.",
              url: process.env.PROD_URL,
              primaryImageOfPage: {
                "@type": "ImageObject",
                url: `${process.env.PROD_URL}/thumbnail.webp`,
              },
            }),
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <CurrencyProvider>
            <AuthProvider>
              <AppBar />
              <AppRouterCacheProvider>{children}</AppRouterCacheProvider>
              <Footer />
              <ScrollToTop />
            </AuthProvider>
          </CurrencyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
