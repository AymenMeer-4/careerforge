"use client";
import React from "react";
import Link from "next/link";
import { useLang } from "@/i18n/LanguageProvider";

export default function LandingPage() {
  const { t } = useLang();

  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="page active" id="page-landing">
      <div className="container hero">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="dot"></span> {t("landing.badge")}
          </div>
          <h1>{t("landing.title")}</h1>
          <p>{t("landing.description")}</p>
          <div className="hero-actions">
            <Link href="/signup" className="btn-primary">
              {t("landing.start_journey")} <span>→</span>
            </Link>
            <button className="btn-secondary" onClick={scrollToFeatures}>
              {t("landing.see_how")}
            </button>
            <Link href="/corporate/signup" className="btn-secondary">
              {t("landing.corporate_portal")}
            </Link>
          </div>
        </div>
      </div>

      <div className="container features" id="features">
        <div className="section-label">{t("landing.features_label")}</div>
        <h2 className="section-title">{t("landing.features_title")}</h2>
        <p className="section-sub">{t("landing.features_sub")}</p>
        <div className="features-grid">
          <div className="feature-card">
            <div className="icon" style={{ background: "rgba(108,92,231,0.15)", color: "#a29bfe" }}>📊</div>
            <h3>{t("landing.feature1_title")}</h3>
            <p>{t("landing.feature1_desc")}</p>
          </div>
          <div className="feature-card">
            <div className="icon" style={{ background: "rgba(0,206,201,0.15)", color: "#00cec9" }}>🎯</div>
            <h3>{t("landing.feature2_title")}</h3>
            <p>{t("landing.feature2_desc")}</p>
          </div>
          <div className="feature-card">
            <div className="icon" style={{ background: "rgba(253,203,110,0.15)", color: "#fdcb6e" }}>🗺️</div>
            <h3>{t("landing.feature3_title")}</h3>
            <p>{t("landing.feature3_desc")}</p>
          </div>
          <div className="feature-card">
            <div className="icon" style={{ background: "rgba(0,184,148,0.15)", color: "#00b894" }}>🔬</div>
            <h3>{t("landing.feature4_title")}</h3>
            <p>{t("landing.feature4_desc")}</p>
          </div>
          <div className="feature-card">
            <div className="icon" style={{ background: "rgba(225,112,85,0.15)", color: "#e17055" }}>💼</div>
            <h3>{t("landing.feature5_title")}</h3>
            <p>{t("landing.feature5_desc")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
