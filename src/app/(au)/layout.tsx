import type { ReactNode } from "react";
import { Barlow, Barlow_Condensed, JetBrains_Mono } from "next/font/google";

// Same three families as box-converter-uniqbe.netlify.app and storeprice.uniqbe.com.
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-barlow",
});
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-barlow-condensed",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-jetbrains",
});

export const metadata = {
  title: "Dropship Revenue Calculator · Uniqbe",
  description:
    "Profit calculator for Uniqbe dropship partners selling into Australia, priced live from the Uniqbe dropship price list.",
};

// Route group for "/": loads the box-converter fonts for the AU calculator only.
export default function AuLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${barlow.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable}`}>
      {children}
    </div>
  );
}
