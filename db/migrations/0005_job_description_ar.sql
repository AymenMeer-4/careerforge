-- 0005 — Bilingual job descriptions. Jobs stored an English-only description;
-- add an Arabic column so the job detail page can show both languages.
-- Idempotent: ADD COLUMN IF NOT EXISTS.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS description_ar TEXT;
