import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Upfor", template: "%s · Upfor" },
  description: "Make a plan in 30 seconds and drop the link in your group chat.",
};

export const viewport: Viewport = {
  themeColor: "#fafaf9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full overflow-x-clip bg-stone-50 text-stone-900">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10">{children}</div>
      </body>
    </html>
  );
}
