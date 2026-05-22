"use client";
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from "react";

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
    setLang(l);
    localStorage.setItem("app_lang", l);
  }, []);

  const value = useMemo(() => ({ lang, setLang: handleSetLang }), [lang, handleSetLang]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
