-- 0004 — Applicant AI Fit Summary cache columns (Build Spec §3.9 / §9.9).
-- Caches the Claude #9 fit summary on the applications row so repeat views of
-- the same applicant do not re-call Claude. Idempotent: ADD COLUMN IF NOT EXISTS.
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS fit_summary_en TEXT,
  ADD COLUMN IF NOT EXISTS fit_summary_ar TEXT,
  ADD COLUMN IF NOT EXISTS fit_summary_risk_flags JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS fit_summary_recommended_action TEXT,
  ADD COLUMN IF NOT EXISTS fit_summary_generated_at TIMESTAMPTZ;
