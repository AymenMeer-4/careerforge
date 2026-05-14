"use client";
import React from "react";
import { useLang } from "@/i18n/LanguageProvider";

export default function HtmlWrapper({ children }: { children: React.ReactNode }) {
  const { lang } = useLang();
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
      {children}
    </html>
  );
}
