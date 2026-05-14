"use client";
import { useLang } from "@/i18n/LanguageProvider";

export default function Page() {
  const { lang } = useLang();
  return (
    <div className="container page active">
      <h1>/corporate/login</h1>
      <p>{lang === 'ar' ? 'الصفحة' : 'Page'}</p>
    </div>
  );
}
