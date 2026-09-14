import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Uniqbe Price Simulator",
  description: "Profit simulator for Uniqbe dropship resellers selling into the UK and Australia",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="m-0 antialiased">{children}</body>
    </html>
  );
}
