"use client";
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";

type Lang = "en" | "zh";

const I18nContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "zh",
  setLang: () => {},
});

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>("zh");

  useEffect(() => {
    const saved = localStorage.getItem("app_lang");
    if (saved === "en" || saved === "zh") setLang(saved);
  }, []);

  const handleSetLang = useCallback((l: Lang) => {
    localStorage.setItem("app_lang", l);
    setLang(l);
  }, []);

  return (
    <I18nContext.Provider value={{ lang, setLang: handleSetLang }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
