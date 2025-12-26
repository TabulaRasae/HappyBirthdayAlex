import type { Metadata } from "next";
import { Fredoka, Luckiest_Guy } from "next/font/google";
import "./globals.css";

const bodyFont = Fredoka({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const displayFont = Luckiest_Guy({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Alexander's Birthday Candle Dash",
  description: "A playful birthday game for Alexander with a high score board.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        {children}
      </body>
    </html>
  );
}
