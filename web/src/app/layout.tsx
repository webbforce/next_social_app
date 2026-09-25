import type { Metadata, Viewport } from "next";
import { Geist, Sora } from "next/font/google";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "upFor", template: "%s · upFor" },
  description: "Make a plan in 30 seconds and drop the link in your group chat.",
};

export const viewport: Viewport = {
  themeColor: "#fafaf8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${sora.variable} h-full antialiased`}>
      <body className="min-h-full overflow-x-clip bg-paper text-ink">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10">{children}</div>
      </body>
    </html>
  );
}
