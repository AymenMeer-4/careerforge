/**
 * lib/corporate-options.ts
 *
 * Role categories, skill ontology, and cert ontology per cluster for the
 * Post-Job form (Section 6.3). Skill keys are kebab-case and match the
 * required_skills keys used by seeded jobs and student_skills.skill_key.
 */

export interface Bi { key: string; en: string; ar: string }

export const ROLE_CATEGORIES: Record<string, Bi[]> = {
  tech: [
    { key: 'ml_engineer', en: 'ML Engineer', ar: 'مهندس تعلم آلي' },
    { key: 'data_scientist', en: 'Data Scientist', ar: 'عالم بيانات' },
    { key: 'full_stack_dev', en: 'Full-Stack Developer', ar: 'مطور متكامل' },
    { key: 'frontend_dev', en: 'Frontend Developer', ar: 'مطور واجهات' },
    { key: 'backend_dev', en: 'Backend Developer', ar: 'مطور خلفية' },
    { key: 'devops_engineer', en: 'DevOps Engineer', ar: 'مهندس DevOps' },
    { key: 'data_engineer', en: 'Data Engineer', ar: 'مهندس بيانات' },
    { key: 'cybersecurity_analyst', en: 'Cybersecurity Analyst', ar: 'محلل أمن سيبراني' },
  ],
  engineering: [
    { key: 'civil_engineer', en: 'Civil Engineer', ar: 'مهندس مدني' },
    { key: 'mechanical_engineer', en: 'Mechanical Engineer', ar: 'مهندس ميكانيكي' },
    { key: 'electrical_engineer', en: 'Electrical Engineer', ar: 'مهندس كهربائي' },
    { key: 'chemical_engineer', en: 'Chemical Engineer', ar: 'مهندس كيميائي' },
    { key: 'industrial_engineer', en: 'Industrial Engineer', ar: 'مهندس صناعي' },
    { key: 'structural_engineer', en: 'Structural Engineer', ar: 'مهندس إنشائي' },
    { key: 'project_engineer', en: 'Project Engineer', ar: 'مهندس مشاريع' },
    { key: 'qa_engineer', en: 'Quality Engineer', ar: 'مهندس جودة' },
  ],
  medicine: [
    { key: 'general_physician', en: 'General Physician', ar: 'طبيب عام' },
    { key: 'nurse', en: 'Nurse', ar: 'ممرض' },
    { key: 'pharmacist', en: 'Pharmacist', ar: 'صيدلي' },
    { key: 'dentist', en: 'Dentist', ar: 'طبيب أسنان' },
    { key: 'lab_technician', en: 'Lab Technician', ar: 'فني مختبر' },
    { key: 'radiologist', en: 'Radiologist', ar: 'أخصائي أشعة' },
    { key: 'physiotherapist', en: 'Physiotherapist', ar: 'أخصائي علاج طبيعي' },
    { key: 'public_health', en: 'Public Health Officer', ar: 'أخصائي صحة عامة' },
  ],
};

export const SKILL_ONTOLOGY: Record<string, Bi[]> = {
  tech: [
    { key: 'python', en: 'Python', ar: 'بايثون' },
    { key: 'javascript', en: 'JavaScript', ar: 'جافاسكربت' },
    { key: 'typescript', en: 'TypeScript', ar: 'تايب سكربت' },
    { key: 'react', en: 'React', ar: 'React' },
    { key: 'nodejs', en: 'Node.js', ar: 'Node.js' },
    { key: 'sql', en: 'SQL', ar: 'SQL' },
    { key: 'machine-learning', en: 'Machine Learning', ar: 'تعلم الآلة' },
    { key: 'deep-learning', en: 'Deep Learning', ar: 'التعلم العميق' },
    { key: 'statistics', en: 'Statistics', ar: 'الإحصاء' },
    { key: 'data-engineering', en: 'Data Engineering', ar: 'هندسة البيانات' },
    { key: 'mlops', en: 'MLOps', ar: 'MLOps' },
    { key: 'docker', en: 'Docker', ar: 'Docker' },
    { key: 'cloud-computing', en: 'Cloud Computing', ar: 'الحوسبة السحابية' },
    { key: 'devops', en: 'DevOps', ar: 'DevOps' },
    { key: 'data-visualization', en: 'Data Visualization', ar: 'تصور البيانات' },
  ],
  engineering: [
    { key: 'autocad', en: 'AutoCAD', ar: 'أوتوكاد' },
    { key: 'solidworks', en: 'SolidWorks', ar: 'سوليدوركس' },
    { key: 'matlab', en: 'MATLAB', ar: 'ماتلاب' },
    { key: 'project-management', en: 'Project Management', ar: 'إدارة المشاريع' },
    { key: 'finite-element-analysis', en: 'FEA', ar: 'تحليل العناصر المحدودة' },
    { key: 'thermodynamics', en: 'Thermodynamics', ar: 'الديناميكا الحرارية' },
    { key: 'circuit-design', en: 'Circuit Design', ar: 'تصميم الدوائر' },
    { key: 'control-systems', en: 'Control Systems', ar: 'أنظمة التحكم' },
    { key: 'structural-analysis', en: 'Structural Analysis', ar: 'التحليل الإنشائي' },
    { key: 'quality-control', en: 'Quality Control', ar: 'ضبط الجودة' },
    { key: 'safety-engineering', en: 'Safety Engineering', ar: 'هندسة السلامة' },
    { key: 'lean-manufacturing', en: 'Lean Manufacturing', ar: 'التصنيع الرشيق' },
  ],
  medicine: [
    { key: 'patient-care', en: 'Patient Care', ar: 'رعاية المرضى' },
    { key: 'clinical-diagnosis', en: 'Clinical Diagnosis', ar: 'التشخيص السريري' },
    { key: 'pharmacology', en: 'Pharmacology', ar: 'علم الأدوية' },
    { key: 'anatomy', en: 'Anatomy', ar: 'علم التشريح' },
    { key: 'medical-ethics', en: 'Medical Ethics', ar: 'أخلاقيات الطب' },
    { key: 'first-aid', en: 'First Aid', ar: 'الإسعافات الأولية' },
    { key: 'lab-techniques', en: 'Lab Techniques', ar: 'تقنيات المختبر' },
    { key: 'radiology', en: 'Radiology', ar: 'الأشعة' },
    { key: 'infection-control', en: 'Infection Control', ar: 'مكافحة العدوى' },
    { key: 'medical-records', en: 'Medical Records', ar: 'السجلات الطبية' },
  ],
};

export const CERT_ONTOLOGY: Record<string, Bi[]> = {
  tech: [
    { key: 'aws-machine-learning', en: 'AWS ML Specialty', ar: 'AWS ML' },
    { key: 'aws-developer', en: 'AWS Developer', ar: 'AWS Developer' },
    { key: 'aws-solutions-architect', en: 'AWS Solutions Architect', ar: 'AWS Solutions Architect' },
    { key: 'tensorflow-developer', en: 'TensorFlow Developer', ar: 'TensorFlow Developer' },
    { key: 'google-data-analytics', en: 'Google Data Analytics', ar: 'Google Data Analytics' },
    { key: 'azure-fundamentals', en: 'Azure Fundamentals', ar: 'Azure Fundamentals' },
  ],
  engineering: [
    { key: 'pmp', en: 'PMP', ar: 'PMP' },
    { key: 'six-sigma', en: 'Six Sigma', ar: 'Six Sigma' },
    { key: 'osha', en: 'OSHA Safety', ar: 'سلامة OSHA' },
    { key: 'autocad-certified', en: 'AutoCAD Certified', ar: 'AutoCAD معتمد' },
  ],
  medicine: [
    { key: 'bls', en: 'BLS', ar: 'BLS' },
    { key: 'acls', en: 'ACLS', ar: 'ACLS' },
    { key: 'scfhs', en: 'SCFHS Registration', ar: 'تسجيل الهيئة السعودية' },
  ],
};

export function clusterFromSector(sector: string): 'tech' | 'engineering' | 'medicine' {
  if (sector === 'engineering' || sector === 'medicine') return sector;
  return 'tech';
}
