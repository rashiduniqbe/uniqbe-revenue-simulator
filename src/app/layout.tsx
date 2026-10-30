import "./globals.css";
import type { ReactNode } from "react";
import { Poppins } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata = {
  title: "Uniqbe Price Simulator",
  description: "Profit simulator for Uniqbe dropship resellers selling into the UK and Australia",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${poppins.className} m-0 antialiased`}>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
