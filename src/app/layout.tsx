import type { Metadata, Viewport } from "next";
import "./globals.css";

const TITLE = "Cosmoscope — explore the universe from anywhere";
const DESCRIPTION =
  "A web planetarium and space-exploration simulator: watch the real sky from any world, fly through the Solar System, and time-travel to eclipses and oppositions.";

export const metadata: Metadata = {
  // Used to resolve og:image & co. to absolute URLs — set to your real domain.
  metadataBase: new URL("https://cosmoscope.ryandhika.dev"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Cosmoscope",
    type: "website",
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#05070f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
