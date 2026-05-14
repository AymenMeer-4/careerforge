const fs = require('fs');
const path = require('path');

const pages = [
  '/signup', '/login', '/onboarding', '/dashboard', '/profile', '/skills', '/roadmap', 
  '/simulator', '/insights', '/mock-interview', '/jobs', '/jobs/[id]', '/applications',
  '/corporate', '/corporate/signup', '/corporate/login', '/corporate/dashboard', 
  '/corporate/post-job', '/corporate/jobs/[id]/applicants', '/corporate/jobs/[id]/applicants/[appId]'
];

for (const p of pages) {
  const dirPath = path.join(__dirname, 'app', p);
  fs.mkdirSync(dirPath, { recursive: true });
  
  const filePath = path.join(dirPath, 'page.tsx');
  if (!fs.existsSync(filePath)) {
    const componentName = p.replace(/[^a-zA-Z0-9]/g, '');
    const content = `"use client";
import { useLang } from "@/i18n/LanguageProvider";

export default function Page() {
  const { lang } = useLang();
  return (
    <div className="container page active">
      <h1>${p}</h1>
      <p>{lang === 'ar' ? 'الصفحة' : 'Page'}</p>
    </div>
  );
}
`;
    fs.writeFileSync(filePath, content);
  }
}
console.log('Pages created successfully.');
