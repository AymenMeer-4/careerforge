-- 0003 — Skill Validation Mini-Check columns (Build Spec §3.12).
-- The validation_* columns were missing from 0001_initial.sql; every skill save
-- fails until they exist. Idempotent: ADD COLUMN IF NOT EXISTS.
ALTER TABLE student_skills
  ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (validation_status IN ('not_required','skipped','validated','dropped','failed')),
  ADD COLUMN IF NOT EXISTS validation_questions JSONB,
  ADD COLUMN IF NOT EXISTS validation_responses JSONB,
  ADD COLUMN IF NOT EXISTS validation_score NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS validation_notes TEXT,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;
