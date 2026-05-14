-- 3.1 users (base table for both roles)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,                                    -- bcrypt hash
  name TEXT NOT NULL,                                              -- full name (student or contact person)
  phone TEXT NOT NULL,                                             -- +966… preferred
  role TEXT NOT NULL CHECK (role IN ('student', 'corporate')),
  language_pref TEXT NOT NULL DEFAULT 'en' CHECK (language_pref IN ('en', 'ar')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.3 students (profile extends user)
CREATE TABLE students (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- onboarding (6 required fields):
  university TEXT NOT NULL,
  region TEXT NOT NULL,
  specialty TEXT NOT NULL,
  cluster TEXT NOT NULL CHECK (cluster IN ('medicine','engineering','tech','unsupported')),
  year_of_study TEXT NOT NULL,           -- '1'..'6' or 'graduate'
  gpa_scale TEXT NOT NULL,                -- '4.0' / '5.0' / '100'
  gpa_value NUMERIC(5,2) NOT NULL,
  onboarding_completed_at TIMESTAMPTZ,
  -- profile completion fields (nullable until filled):
  city TEXT,
  opportunity_types JSONB NOT NULL DEFAULT '[]',   -- ['full_time','internship','coop','training']
  employment_experience TEXT,
  hours_per_week INT,
  interests JSONB NOT NULL DEFAULT '[]',
  target_role TEXT,                                  -- e.g. 'ml_engineer'
  profile_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.4 student_courses (from transcript Vision or manual entry)
CREATE TABLE student_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  course_name TEXT NOT NULL,
  course_code TEXT,
  credits NUMERIC(4,1),
  grade TEXT,
  semester TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','transcript_vision')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.5 student_experiences (certs, training, hackathons, events)
CREATE TABLE student_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('certificate','training','hackathon','event','internship')),
  title TEXT NOT NULL,
  issuer TEXT,
  date_completed DATE,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','pending','verified','rejected')),
  verification_method TEXT,    -- 'ai_inspection' / 'manual' / null
  verification_confidence NUMERIC(4,2),
  verification_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.6 student_dimensions (cached scores, recomputed on profile change)
CREATE TABLE student_dimensions (
  student_id UUID PRIMARY KEY REFERENCES students(user_id) ON DELETE CASCADE,
  dim_academic NUMERIC(5,2) NOT NULL DEFAULT 0,
  dim_credentialing NUMERIC(5,2) NOT NULL DEFAULT 0,
  dim_practical NUMERIC(5,2) NOT NULL DEFAULT 0,
  dim_portfolio NUMERIC(5,2) NOT NULL DEFAULT 0,
  dim_domain NUMERIC(5,2) NOT NULL DEFAULT 0,
  dim_prof_dev NUMERIC(5,2) NOT NULL DEFAULT 0,
  dim_soft_skills NUMERIC(5,2) NOT NULL DEFAULT 0,
  general_readiness NUMERIC(5,2) NOT NULL DEFAULT 0,
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.7 corporates
CREATE TABLE corporates (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  sector TEXT NOT NULL CHECK (sector IN ('medicine','engineering','tech','other')),
  cr_number TEXT NOT NULL,    -- 10-digit Saudi CR
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending','verified')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.8 jobs
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corporate_id UUID NOT NULL REFERENCES corporates(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  posting_type TEXT NOT NULL CHECK (posting_type IN ('full_time','internship','coop','training')),
  role_category TEXT NOT NULL,         -- 'ml_engineer' / 'data_scientist' / etc.
  cluster TEXT NOT NULL CHECK (cluster IN ('medicine','engineering','tech')),
  description TEXT NOT NULL,
  location_region TEXT NOT NULL,
  location_city TEXT NOT NULL,
  salary_min INT,
  salary_max INT,
  required_skills JSONB NOT NULL DEFAULT '[]',     -- [{skill, importance}]
  required_certs JSONB NOT NULL DEFAULT '[]',
  required_experience_years INT NOT NULL DEFAULT 0,
  required_education_level TEXT NOT NULL,
  dimension_requirements JSONB NOT NULL,    -- {dim_academic: 60, dim_credentialing: 70, ...}
  hiring_outcome_flag BOOLEAN NOT NULL DEFAULT false,   -- Tier 1 trigger
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  is_seeded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.9 applications
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','under_review','interview','offered','rejected','withdrawn')),
  match_score NUMERIC(5,2) NOT NULL,
  rejection_primary_reason TEXT,
  rejection_gap_tags JSONB,     -- array of skill tags
  rejection_comment TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, student_id)
);

-- 3.10 roadmap_nodes
CREATE TABLE roadmap_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  dimension_target TEXT NOT NULL,    -- which of the 7 dims this node improves
  difficulty INT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  hours INT NOT NULL,
  points INT NOT NULL,
  tier INT NOT NULL CHECK (tier BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'unlocked'
    CHECK (status IN ('locked','unlocked','in_progress','completed')),
  order_index INT NOT NULL,
  resources JSONB NOT NULL DEFAULT '[]',   -- [{title, url, provider, type, hours, language, cost}]
  why_this_tier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 3.11 mock_interview_sessions
CREATE TABLE mock_interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  scenario_key TEXT NOT NULL,
  response_text TEXT NOT NULL,
  clarity NUMERIC(4,1) NOT NULL,
  specificity NUMERIC(4,1) NOT NULL,
  relevance NUMERIC(4,1) NOT NULL,
  depth NUMERIC(4,1) NOT NULL,
  structure NUMERIC(4,1) NOT NULL,
  total_score NUMERIC(5,2) NOT NULL,
  feedback_text TEXT NOT NULL,
  improvement_areas JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.12 student_skills
CREATE TABLE student_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  skill_key TEXT NOT NULL,                          -- kebab-case slug, used to match required_skills in jobs
  skill_canonical_name TEXT NOT NULL,                -- e.g. "Python"
  description_en TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  proficiency_level TEXT NOT NULL                    -- STUDENT'S choice
    CHECK (proficiency_level IN ('low','mid','high')),
  proficiency_score INT NOT NULL                     -- derived from level: low=30, mid=60, high=90
    CHECK (proficiency_score BETWEEN 0 AND 100),
  ai_suggested_level TEXT                            -- AI's initial suggestion (informational, nullable)
    CHECK (ai_suggested_level IN ('low','mid','high')),
  reasoning_en TEXT NOT NULL,
  reasoning_ar TEXT NOT NULL,
  iteration_count INT NOT NULL DEFAULT 0,            -- how many feedback rounds it took
  fully_approved BOOLEAN NOT NULL DEFAULT true,      -- false if 5-iteration cap was hit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, skill_key)
);
