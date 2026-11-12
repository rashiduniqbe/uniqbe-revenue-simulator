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
  title: "AU dropship calculator (prototype) · Uniqbe",
  robots: { index: false, follow: false },
};

export default function PrototypeLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${barlow.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable}`}>
      {children}
    </div>
  );
}
