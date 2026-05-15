'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageProvider';

export default function LandingPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (res.ok) {
          router.replace('/dashboard');
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, []);

  if (checking) return null;

  return (
    <div className="landing-page">
      <section className="hero">
        <div className="container hero-content">
          <div className="hero-badge">
            <span className="dot"></span> {t('landing.badge')}
          </div>
          <h1 className="hero-title">{t('landing.title')}</h1>
          <p className="hero-description">{t('landing.description')}</p>
          <div className="hero-actions">
            <button
              onClick={() => router.push('/login')}
              className="btn-primary"
            >
              {t('landing.cta_student')} <span>→</span>
            </button>
            <button
              onClick={() => router.push('/corporate/signup')}
              className="btn-secondary"
            >
              {t('landing.cta_corporate')}
            </button>
          </div>
        </div>
      </section>

      <section className="features" id="features">
        <div className="container">
          <div className="features-grid">
            <div className="feature-card">
              <div className="icon" style={{ background: 'rgba(108,92,231,0.15)', color: '#a29bfe' }}>📊</div>
              <h3>{t('landing.feature1_title')}</h3>
              <p>{t('landing.feature1_desc')}</p>
            </div>
            <div className="feature-card">
              <div className="icon" style={{ background: 'rgba(0,206,201,0.15)', color: '#00cec9' }}>🗺️</div>
              <h3>{t('landing.feature2_title')}</h3>
              <p>{t('landing.feature2_desc')}</p>
            </div>
            <div className="feature-card">
              <div className="icon" style={{ background: 'rgba(253,203,110,0.15)', color: '#fdcb6e' }}>📈</div>
              <h3>{t('landing.feature3_title')}</h3>
              <p>{t('landing.feature3_desc')}</p>
            </div>
            <div className="feature-card">
              <div className="icon" style={{ background: 'rgba(0,184,148,0.15)', color: '#00b894' }}>💼</div>
              <h3>{t('landing.feature4_title')}</h3>
              <p>{t('landing.feature4_desc')}</p>
            </div>
            <div className="feature-card">
              <div className="icon" style={{ background: 'rgba(225,112,85,0.15)', color: '#e17055' }}>🎤</div>
              <h3>{t('landing.feature5_title')}</h3>
              <p>{t('landing.feature5_desc')}</p>
            </div>
            <div className="feature-card">
              <div className="icon" style={{ background: 'rgba(108,92,231,0.15)', color: '#a29bfe' }}>📜</div>
              <h3>{t('landing.feature6_title')}</h3>
              <p>{t('landing.feature6_desc')}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}