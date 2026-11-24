import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { GeistPixelSquare } from "geist/font/pixel/square";
import { AgentBridge } from "@/components/site/agent-bridge";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const title = "Torso: the CMS with no head";
const description =
  "Torso is a visual editor for Next.js with no head, no backend and no schema. Click the words on your site and they change in your code.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: { type: "website", siteName: "Torso", title, description, url: "/" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${GeistPixelSquare.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <noscript>
          <style>{"[data-reveal],[data-reveal] .glyph rect{opacity:1}"}</style>
        </noscript>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-foreground focus:px-4 focus:py-2 focus:text-background"
        >
          Skip to content
        </a>
        {children}
        <AgentBridge />
      </body>
    </html>
  );
}
