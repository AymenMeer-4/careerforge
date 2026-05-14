"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/i18n/LanguageProvider";
import { usePathname, useRouter } from "next/navigation";

export default function Nav() {
  const { lang, setLang, t } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setIsLoggedIn(false);
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) setIsLoggedIn(true);
        else setIsLoggedIn(false);
      })
      .catch(() => setIsLoggedIn(false));
  }, [pathname]);

  return (
    <nav className={`nav ${scrolled ? "scrolled" : ""}`} id="navbar">
      <Link href="/" className="nav-logo">
        <svg viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" stroke="url(#lg1)" strokeWidth="2.5" />
          <path d="M10 18 L16 10 L22 18" stroke="url(#lg1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="16" y1="10" x2="16" y2="24" stroke="url(#lg1)" strokeWidth="2.5" strokeLinecap="round" />
          <defs>
            <linearGradient id="lg1" x1="0" y1="0" x2="32" y2="32">
              <stop stopColor="#6c5ce7" />
              <stop offset="1" stopColor="#00cec9" />
            </linearGradient>
          </defs>
        </svg>
        CareerForge <span className="text-gradient">AI</span>
      </Link>
      
      {isLoggedIn && (
        <div className="nav-links">
          <Link href="/" className={pathname === "/" ? "active" : ""}>{t("nav.home")}</Link>
          <Link href="/dashboard" className={pathname === "/dashboard" ? "active" : ""}>{t("nav.dashboard")}</Link>
          <Link href="/simulator" className={pathname === "/simulator" ? "active" : ""}>{t("nav.simulator")}</Link>
          <Link href="/skills" className={pathname === "/skills" ? "active" : ""}>{t("nav.skills")}</Link>
          <Link href="/roadmap" className={pathname === "/roadmap" ? "active" : ""}>{t("nav.roadmap")}</Link>
          <button onClick={handleLogout} className="nav-link logout-btn">
            {t("nav.logout")}
          </button>
        </div>
      )}
      <div className="nav-right">
        <div className="lang-toggle">
          <button 
            className={`lang-btn ${lang === "en" ? "active" : ""}`} 
            onClick={() => setLang("en")}
          >
            EN
          </button>
          <button 
            className={`lang-btn ${lang === "ar" ? "active" : ""}`} 
            onClick={() => setLang("ar")}
          >
            عربي
          </button>
        </div>
        
        {isLoggedIn && (
          <div className="user-menu" id="userMenu">
            <button className="user-avatar" id="userAvatarBtn" aria-label="User menu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 21v-1a6 6 0 0 1 12 0v1"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}