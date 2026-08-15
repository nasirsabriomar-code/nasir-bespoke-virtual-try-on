import type { Metadata } from "next";
import "./globals.css";

function getMetadataBase() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelUrl = process.env.VERCEL_URL;
  const url = configuredUrl || (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000");

  try {
    return new URL(url);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: "Virtual Try-On | Nasir Bespoke",
  description:
    "See yourself in a garment with the Nasir Bespoke AI Virtual Try-On.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Nasir Try-On",
  },
  openGraph: {
    title: "Nasir Bespoke — Virtual Try-On",
    description: "Two images in. One refined try-on out.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1672,
        height: 941,
        alt: "Nasir Bespoke Virtual Try-On",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nasir Bespoke — Virtual Try-On",
    description: "Two images in. One refined try-on out.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
