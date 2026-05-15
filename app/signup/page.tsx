'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/i18n/LanguageProvider';

export default function StudentSignup() {
  const router = useRouter();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const phoneRegex = /^(\+9665\d{8}|05\d{8})$/;
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&^_-]{8,}$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) return setError(t('auth.error_name_required'));
    if (!formData.email.trim()) return setError(t('auth.error_email_required'));
    if (!phoneRegex.test(formData.phone)) return setError(t('auth.error_invalid_phone'));
    if (!passwordRegex.test(formData.password)) {
      return setError(t('auth.error_invalid_password'));
    }
    if (formData.password !== formData.confirmPassword) {
      return setError(t('auth.error_password_mismatch'));
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'student',
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t('auth.error_signup_failed'));
      } else {
        router.push('/onboarding');
      }
    } catch (err) {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{t('auth.student_signup')}</h1>
        <p className="auth-subtitle">{t('auth.have_account')} <Link href="/login">{t('auth.sign_in_link')}</Link></p>
        
        {error && <div className="field-error" style={{ marginBottom: '1rem' }}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('auth.name')}</label>
            <input
              type="text"
              className="input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('auth.email')}</label>
            <input
              type="email"
              className="input"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('auth.phone')}</label>
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
            {loading ? t('auth.creating_account') : t('auth.signup')}
          </button>
        </form>
        
        <div className="auth-footer">
          <p>{t('auth.or_corporate')}</p>
          <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <Link href="/corporate/signup">{t('auth.corporate_signup')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
