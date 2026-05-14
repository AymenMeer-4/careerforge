import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/styles/globals.css";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import HtmlWrapper from "@/components/HtmlWrapper";
import Nav from "@/components/Nav";
import { cookies } from "next/headers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CareerForge AI",
  description: "Data-Driven Career Guidance",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const langCookie = cookieStore.get("careerforge_lang")?.value;
  const initialLang = (langCookie === "ar" ? "ar" : "en") as "en" | "ar";

  return (
    <LanguageProvider initialLang={initialLang}>
      <HtmlWrapper>
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </head>
        <body className={`${geistSans.variable} ${geistMono.variable}`}>
          <Nav />
          {children}
        </body>
      </HtmlWrapper>
    </LanguageProvider>
  );
}
