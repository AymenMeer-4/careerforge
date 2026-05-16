/**
 * lib/locations.ts
 *
 * Bilingual (English + Arabic) Saudi regions and cities. Jobs store the English
 * region/city string; the UI renders both languages via these maps so a job
 * offering shows e.g. "Riyadh — الرياض".
 */

export interface Region {
  en: string;
  ar: string;
  cities: { en: string; ar: string }[];
}

export const REGIONS: Region[] = [
  {
    en: 'Riyadh', ar: 'الرياض',
    cities: [
      { en: 'Riyadh', ar: 'الرياض' },
      { en: 'Al Kharj', ar: 'الخرج' },
      { en: 'Diriyah', ar: 'الدرعية' },
    ],
  },
  {
    en: 'Makkah', ar: 'مكة المكرمة',
    cities: [
      { en: 'Jeddah', ar: 'جدة' },
      { en: 'Makkah', ar: 'مكة المكرمة' },
      { en: 'Taif', ar: 'الطائف' },
    ],
  },
  {
    en: 'Madinah', ar: 'المدينة المنورة',
    cities: [
      { en: 'Madinah', ar: 'المدينة المنورة' },
      { en: 'Yanbu', ar: 'ينبع' },
    ],
  },
  {
    en: 'Eastern Province', ar: 'المنطقة الشرقية',
    cities: [
      { en: 'Dammam', ar: 'الدمام' },
      { en: 'Dhahran', ar: 'الظهران' },
      { en: 'Al Khobar', ar: 'الخبر' },
      { en: 'Jubail', ar: 'الجبيل' },
    ],
  },
  {
    en: 'Asir', ar: 'عسير',
    cities: [
      { en: 'Abha', ar: 'أبها' },
      { en: 'Khamis Mushait', ar: 'خميس مشيط' },
    ],
  },
  {
    en: 'Qassim', ar: 'القصيم',
    cities: [
      { en: 'Buraydah', ar: 'بريدة' },
      { en: 'Unaizah', ar: 'عنيزة' },
    ],
  },
  {
    en: 'Tabuk', ar: 'تبوك',
    cities: [
      { en: 'Tabuk', ar: 'تبوك' },
      { en: 'NEOM', ar: 'نيوم' },
    ],
  },
];

const CITY_AR: Record<string, string> = {};
const REGION_AR: Record<string, string> = {};
for (const r of REGIONS) {
  REGION_AR[r.en.toLowerCase()] = r.ar;
  for (const c of r.cities) CITY_AR[c.en.toLowerCase()] = c.ar;
}

/** Arabic name for an English city, or the original string if unknown. */
export function cityAr(en: string): string {
  return CITY_AR[String(en ?? '').toLowerCase()] ?? en;
}

/** Arabic name for an English region, or the original string if unknown. */
export function regionAr(en: string): string {
  return REGION_AR[String(en ?? '').toLowerCase()] ?? en;
}

/** Bilingual label, e.g. "Jeddah — جدة". When lang==='ar' the Arabic leads. */
export function cityLabel(en: string, lang: 'en' | 'ar'): string {
  const ar = cityAr(en);
  if (!en) return '';
  if (ar === en) return en;
  return lang === 'ar' ? `${ar} — ${en}` : `${en} — ${ar}`;
}

export function regionLabel(en: string, lang: 'en' | 'ar'): string {
  const ar = regionAr(en);
  if (!en) return '';
  if (ar === en) return en;
  return lang === 'ar' ? `${ar} — ${en}` : `${en} — ${ar}`;
}
