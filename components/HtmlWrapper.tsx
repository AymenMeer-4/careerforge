'use client'
import { useLanguage } from '@/i18n/LanguageProvider'

export default function HtmlWrapper({ children }: { children: React.ReactNode }) {
  const { lang } = useLanguage()
  return (
    <html lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <body className="app">{children}</body>
    </html>
  )
}
