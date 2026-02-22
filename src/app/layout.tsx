import { APP_CONFIG, ROOT_METADATA, geistMono, interSans } from "@/core";
import { ReactQueryProvider } from "@/components/providers/react-query-provider";
import { SonnerToaster } from "@/components/ui/sonner-toaster";

import "./globals.css";

export const metadata = ROOT_METADATA;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={APP_CONFIG.locale}>
      <body
        className={`${interSans.variable} ${geistMono.variable} antialiased`}
      >
        <ReactQueryProvider>
          {children}
          <SonnerToaster />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
