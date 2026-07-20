import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EvidenceFlow — Research with receipts",
  description: "An evidence-first research agent that turns a question into a reusable research workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* RootLayout is shared by every App Router route; this is not a page-scoped font. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link 
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
