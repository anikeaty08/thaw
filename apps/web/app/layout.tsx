import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { ThemeProvider, themeInitScript } from "@/components/providers/ThemeProvider";
import "./globals.css";

const body = Geist({
  subsets: ["latin"],
  variable: "--font-body",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Thaw — Your locks earn. Now they lend.",
  description:
    "Borrow MUSD against locked veMEZO or veBTC. Every Thursday, your Mezo Earn rewards pay the loan down automatically.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-body">
        <ThemeProvider>
          <Web3Provider>{children}</Web3Provider>
        </ThemeProvider>
      </body>
    </html>
  );
}
