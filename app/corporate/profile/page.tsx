'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageProvider';

interface CorporateProfile {
  company_name: string;
  sector: string;
  cr_number: string;
  verification_status: string;
  contact_name: string;
  email: string;
  phone: string;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="experience-row">
      <div className="experience-info">
        <span className="experience-meta">{label}</span>
        <span className="experience-title-text">{value || '—'}</span>
      </div>
    </div>
  );
}

export default function CorporateProfilePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CorporateProfile | null>(null);

  useEffect(() => {
    (async () => {
      const me = await fetch('/api/auth/me');
      if (me.status === 401) { router.push('/corporate/login'); return; }
      const meData = await me.json();
      if (meData.role !== 'corporate') { router.push('/dashboard'); return; }

      const res = await fetch('/api/corporates/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile ?? null);
      }
      setLoading(false);
    })().catch(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!profile) return null;

  const verified = profile.verification_status === 'verified';

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1 className="auth-title">{t('corporate.company_profile')}</h1>
          <p className="auth-subtitle">{t('corporate.company_profile_subtitle')}</p>
        </div>
      </header>

      <div
        className="alert-banner"
        style={{
          background: verified ? 'rgba(0,184,148,0.12)' : 'rgba(243,156,18,0.12)',
          borderColor: verified ? '#00b894' : '#f39c12',
          color: verified ? '#00b894' : '#b9770e',
          marginBottom: '1.25rem',
        }}
      >
        {verified ? t('corporate.verification_verified') : t('corporate.verification_pending')}
      </div>

      <div className="profile-section" style={{ marginBottom: '1.25rem' }}>
        <h2 className="profile-section-title">{t('corporate.section_company')}</h2>
        <div className="experience-list">
          <Field label={t('auth.company_name')} value={profile.company_name} />
          <Field label={t('auth.sector')} value={t(`auth.sector_${profile.sector}`)} />
          <Field label={t('auth.cr_number')} value={profile.cr_number} />
          <Field
            label={t('corporate.account_status')}
            value={verified ? t('corporate.verification_verified') : t('corporate.verification_pending')}
          />
        </div>
      </div>

      <div className="profile-section">
        <h2 className="profile-section-title">{t('corporate.section_contact')}</h2>
        <div className="experience-list">
          <Field label={t('corporate.contact_person')} value={profile.contact_name} />
          <Field label={t('auth.contact_email')} value={profile.email} />
          <Field label={t('auth.contact_phone')} value={profile.phone} />
        </div>
      </div>
    </div>
  );
}
