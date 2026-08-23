import type { Metadata } from "next";
import "./globals.css";
import VisualEditsMessenger from "../visual-edits/VisualEditsMessenger";
import ErrorReporter from "@/components/ErrorReporter";
import Script from "next/script";
import { BrandProvider } from "@/components/BrandProvider";
import { fetchPlatformBranding } from "@/lib/platform-branding";

// Title follows the admin-configured App Name, so renaming the platform in
// Miscellaneous Settings updates the browser tab here too.
export async function generateMetadata(): Promise<Metadata> {
  const { appName, logoSquareUrl } = await fetchPlatformBranding();
  return {
    title: `${appName} - Forex Trading Platform`,
    description: `Professional Forex Trading Platform`,
    icons: {
      icon: logoSquareUrl || '/logo/logo_white.png',
      dark: logoSquareUrl || '/logo/logo_dark.png',
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = await fetchPlatformBranding();
  return (
    <html lang="en">
      <body className="antialiased">
        <ErrorReporter />
        <Script
          src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/scripts//route-messenger.js"
          strategy="afterInteractive"
          data-target-origin="*"
          data-message-type="ROUTE_CHANGE"
          data-include-search-params="true"
          data-only-in-iframe="true"
          data-debug="true"
          data-custom-data='{"appName": "YourApp", "version": "1.0.0", "greeting": "hi"}'
        />
        <BrandProvider initial={branding}>{children}</BrandProvider>
        <VisualEditsMessenger />
      </body>
    </html>
  );
}
