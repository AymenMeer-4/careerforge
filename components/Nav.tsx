'use client';
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/i18n/LanguageProvider';
import { usePathname, useRouter } from 'next/navigation';

export default function Nav() {
  const { lang, setLang, t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setIsLoggedIn(false);
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (res.ok) setIsLoggedIn(true);
        else setIsLoggedIn(false);
      })
      .catch(() => setIsLoggedIn(false));
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className={`nav ${scrolled ? 'scrolled' : ''}`} id="navbar">
      <Link href="/" className="nav-logo">
        <svg viewBox="0 0 32 32" fill="none" style={{ width: '32px', height: '32px' }}>
          <circle cx="16" cy="16" r="14" stroke="url(#lg1)" strokeWidth="2.5" />
          <path d="M10 18 L16 10 L22 18" stroke="url(#lg1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="16" y1="10" x2="16" y2="24" stroke="url(#lg1)" strokeWidth="2.5" strokeLinecap="round" />
          <defs>
            <linearGradient id="lg1" x1="0" y1="0" x2="32" y2="32">
              <stop stopColor="#6c5ce7" />
              <stop offset="1" stopColor="#00cec9" />
            </linearGradient>
          </defs>
        </svg>
        <span>CareerForge <span className="text-gradient">AI</span></span>
      </Link>

      {/* Authenticated nav links — hidden when logged out */}
      {isLoggedIn && (
        <div className="nav-links">
          <Link href="/dashboard" className={pathname === '/dashboard' ? 'active' : ''}>{t('nav.dashboard')}</Link>
          <Link href="/simulator" className={pathname === '/simulator' ? 'active' : ''}>{t('nav.simulator')}</Link>
          <Link href="/skills" className={pathname === '/skills' ? 'active' : ''}>{t('nav.skills')}</Link>
          <Link href="/roadmap" className={pathname === '/roadmap' ? 'active' : ''}>{t('nav.roadmap')}</Link>
        </div>
      )}

      <div className="nav-right" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div className="lang-toggle">
          <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
          <button className={`lang-btn ${lang === 'ar' ? 'active' : ''}`} onClick={() => setLang('ar')}>عربي</button>
        </div>

        {!isLoggedIn && (
          <Link href="/login" className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>
            {t('nav.login')}
          </Link>
        )}

        {isLoggedIn && (
          <div className="profile-dropdown-container" ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              className="btn-secondary"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                padding: '0.5rem',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border)'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </button>

            {dropdownOpen && (
              <div className="profile-dropdown" style={{
                position: 'absolute',
                top: '120%',
                right: 0,
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-lg)',
                minWidth: '180px',
                overflow: 'hidden',
                zIndex: 1000
              }}>
                <Link
                  href="/profile"
                  onClick={() => setDropdownOpen(false)}
                  style={{
                    display: 'block',
                    padding: '0.75rem 1rem',
                    color: 'var(--text)',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    borderBottom: '1px solid var(--border)'
                  }}
                >
                  {t('profile.section_basic')}
                </Link>
                <button
                  onClick={handleLogout}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--danger)',
                    textAlign: lang === 'ar' ? 'right' : 'left',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  {t('nav.logout')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}