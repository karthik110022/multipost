import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from '@/context/AuthContext';
import { AnalyticsProvider } from '@/components/AnalyticsProvider';
import Navigation from '@/components/Navigation';
import { Toaster } from 'react-hot-toast';
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MultiPost - Social Media Manager",
  description: "Post to multiple social media platforms at once",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className={`${inter.className} text-gray-900 dark:text-gray-100`}>
        <AuthProvider>
          <AnalyticsProvider>
            <Navigation />
            <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
              {children}
            </main>
            <div id="analytics-container" />
            <Toaster position="bottom-right" />
          </AnalyticsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
