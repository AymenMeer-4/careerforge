'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/i18n/LanguageProvider';

export default function CorporateSignup() {
  const router = useRouter();
  const { t } = useLang();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    companyName: '',
    sector: 'tech', // Default
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

    if (!formData.name.trim()) return setError(t('auth.error_contact_name_required'));
    if (!formData.email.trim()) return setError(t('auth.error_email_required'));
    if (!formData.companyName.trim()) return setError(t('auth.error_company_required'));
    if (!crRegex.test(formData.crNumber)) return setError(t('auth.error_invalid_cr'));
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
    } catch (err) {
      setError(t('auth.error_generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px' }}>
      <h1>{t('auth.corporate_signup_title')}</h1>
      {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>{t('auth.company_name')}</label>
          <input
            type="text"
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>{t('auth.cr_number')}</label>
          <input
            type="text"
            value={formData.crNumber}
            onChange={(e) => setFormData({ ...formData, crNumber: e.target.value })}
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>{t('auth.sector')}</label>
          <select 
            value={formData.sector} 
            onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
            style={{ width: '100%', padding: '8px' }}
          >
            <option value="medicine">{t('auth.sector_medicine')}</option>
            <option value="engineering">{t('auth.sector_engineering')}</option>
            <option value="tech">{t('auth.sector_tech')}</option>
            <option value="other">{t('auth.sector_other')}</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>{t('auth.contact_name')}</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>{t('auth.contact_email')}</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>{t('auth.contact_phone')}</label>
          <input
            type="text"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>{t('auth.password')}</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>{t('auth.confirm_password')}</label>
          <input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>
        <button type="submit" disabled={loading} style={{ padding: '10px', background: '#0070f3', color: 'white', border: 'none', cursor: 'pointer' }}>
          {loading ? t('auth.signing_up') : t('auth.signup')}
        </button>
      </form>
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <p>{t('auth.have_account')} <Link href="/login" style={{ color: '#0070f3' }}>{t('auth.sign_in_link')}</Link></p>
        <p style={{ marginTop: '10px' }}><Link href="/signup" style={{ color: '#0070f3' }}>{t('auth.iam_student')}</Link></p>
      </div>
    </div>
  );
}
