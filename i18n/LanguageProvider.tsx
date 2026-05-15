"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import en from "./en.json";
import ar from "./ar.json";

type Lang = "en" | "ar";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ 
  children, 
  initialLang = "en"
}: { 
  children: React.ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    document.cookie = `careerforge_lang=${newLang}; path=/; max-age=31536000`;
  };

  const t = (key: string): string => {
    const dict = lang === "ar" ? ar : en;
    return (dict as any)[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};

// Keep useLang for backward compatibility if needed, but the user wants useLanguage
export const useLang = useLanguage;

