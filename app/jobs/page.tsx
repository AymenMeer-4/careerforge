'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageProvider';

export default function JobsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => {
        if (r.status === 401) {
          router.push('/login');
          return null;
        }
        return r.json();
      })
      .then(data => {
        if (data) setSession(data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!session) return null;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1 className="auth-title">{t('jobs.title')}</h1>
      </header>
      <div className="dashboard-grid">
        <div className="profile-section" style={{ gridColumn: '1 / -1' }}>
          <h2 className="profile-section-title">{t('jobs.general_readiness')}</h2>
          <p className="experience-meta">Job matching analysis is being prepared.</p>
        </div>
      </div>
    </div>
  );
}
