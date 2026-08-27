import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Redaction desk",
  description: "Manual review of redacted support tickets before AI processing.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
