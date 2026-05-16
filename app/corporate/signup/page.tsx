'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/i18n/LanguageProvider';

export default function CorporateSignup() {
  const router = useRouter();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    companyName: '',
    sector: 'tech',
    crNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const phoneRegex = /^(\+9665\d{8}|05\d{8})$/;
  const crRegex = /^[12345789]\d{9}$/;
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&^_-]{8,}$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.companyName.trim()) return setError(t('auth.error_company_required'));
    if (!crRegex.test(formData.crNumber)) return setError(t('auth.error_invalid_cr'));
    if (!formData.name.trim()) return setError(t('auth.error_contact_name_required'));
    if (!formData.email.trim()) return setError(t('auth.error_email_required'));
    if (!phoneRegex.test(formData.phone)) return setError(t('auth.error_invalid_phone'));
    if (!passwordRegex.test(formData.password)) return setError(t('auth.error_invalid_password'));
    if (formData.password !== formData.confirmPassword) return setError(t('auth.error_password_mismatch'));

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'corporate',
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          companyName: formData.companyName,
          sector: formData.sector,
          crNumber: formData.crNumber,
          password: formData.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('auth.error_signup_failed'));
      } else {
        router.push('/corporate/dashboard');
      }
    } catch {
      setError(t('auth.error_generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{t('auth.corporate_signup_title')}</h1>
        <p className="auth-subtitle">
          {t('auth.have_account')} <Link href="/login">{t('auth.sign_in_link')}</Link>
        </p>

        {error && <div className="field-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('auth.company_name')}</label>
            <input
              type="text"
              className="input"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('auth.cr_number')}</label>
            <input
              type="text"
              className="input"
              placeholder={t('auth.cr_hint')}
              value={formData.crNumber}
              onChange={(e) => setFormData({ ...formData, crNumber: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('auth.sector')}</label>
            <select
              className="input"
              value={formData.sector}
              onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
            >
              <option value="medicine">{t('auth.sector_medicine')}</option>
              <option value="engineering">{t('auth.sector_engineering')}</option>
              <option value="tech">{t('auth.sector_tech')}</option>
              <option value="other">{t('auth.sector_other')}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('auth.contact_name')}</label>
            <input
              type="text"
              className="input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('auth.contact_email')}</label>
            <input
              type="email"
              className="input"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('auth.contact_phone')}</label>
            <input
              type="text"
              className="input"
              placeholder={t('auth.phone_hint')}
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('auth.password')}</label>
            <input
              type="password"
              className="input"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('auth.confirm_password')}</label>
            <input
              type="password"
              className="input"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
            {loading ? t('auth.signing_up') : t('auth.signup')}
          </button>
        </form>

        <div className="auth-footer">
          <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <Link href="/signup">{t('auth.iam_student')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
