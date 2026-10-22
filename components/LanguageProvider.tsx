
"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import {
  translations,
  type Language,
} from "../lib/i18n";

type Translation = {
  [Key in keyof (typeof translations)["ar"]]: string;
};

type LanguageContextType = {
  language: Language;
  toggleLanguage: () => void;
  t: Translation;
};

const LanguageContext =
  createContext<LanguageContextType | null>(null);

export function LanguageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [language, setLanguage] = useState<Language>("ar");

  const toggleLanguage = () => {
    setLanguage((current) =>
      current === "ar" ? "en" : "ar"
    );
  };

  const t: Translation = translations[language];

  return (
    <LanguageContext.Provider
      value={{ language, toggleLanguage, t }}
    >
      <div
        lang={language}
        dir={language === "ar" ? "rtl" : "ltr"}
        className="language-root"
      >
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error(
      "useLanguage must be used inside LanguageProvider"
    );
  }

  return context;
}
