export function mapSpecialtyToCluster(specialty: string): 'medicine' | 'engineering' | 'tech' | 'unsupported' {
  const input = specialty.toLowerCase();

  // Tech keywords (check FIRST — more specific)
  const techKeywords = ["comput", "softw", "data", "ai", "ml", "info", "cyber", "حاسب", "برمج", "بيانات", "ذكاء", "معلومات", "سيبراني", "تقنية"];
  if (techKeywords.some(kw => input.includes(kw))) {
    return 'tech';
  }

  // Engineering keywords (check SECOND)
  const engKeywords = ["civil", "mech", "elec", "chem", "indust", "هندس", "مدني", "ميكانيك", "كهرب", "كيمي", "صناع"];
  if (engKeywords.some(kw => input.includes(kw))) {
    return 'engineering';
  }

  // Medicine keywords (check LAST)
  const medKeywords = ["medic", "pharm", "dent", "nurs", "surg", "health", "طبيب", "صيدل", "أسنان", "تمريض", "جراح", "صحي"];
  if (medKeywords.some(kw => input.includes(kw))) {
    return 'medicine';
  }

  return 'unsupported';
}