import '@/styles/globals.css'
import { LanguageProvider } from '@/i18n/LanguageProvider'
import Nav from '@/components/Nav'
import HtmlWrapper from '@/components/HtmlWrapper'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <HtmlWrapper>
        <Nav />
        <main className="main-content">
          {children}
        </main>
      </HtmlWrapper>
    </LanguageProvider>
  )
}
