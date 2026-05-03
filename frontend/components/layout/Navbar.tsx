"use client";

import { Network, LogOut } from "lucide-react";

interface NavbarProps {
  liveState: string;
  readyState: string;
  lang: string;
  onToggleLang: () => void;
  userName: string;
  onSignOut: () => void;
  t: <T>(en: T, zh: T) => T;
}

export default function Navbar({
  liveState,
  readyState,
  lang,
  onToggleLang,
  userName,
  onSignOut,
  t,
}: NavbarProps) {
  return (
    <nav className="h-14 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black/50 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-6">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Network className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold tracking-tight text-lg">
          {t("API Control Center", "API 控制中心")}
        </span>
        <span
          className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          title={t("Current environment/region", "当前运行环境/可用区")}
        >
          {t("prod-zone-1", "生产区-1")}
        </span>
      </div>
      <div className="flex items-center space-x-6 text-sm font-medium">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <div
              className={`w-2 h-2 rounded-full ${
                liveState === "ok" ? "bg-green-500" : "bg-red-500"
              } shadow-lg`}
            />
            <span>
              {t("Live: ", "存活: ")}
              {liveState}
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div
              className={`w-2 h-2 rounded-full ${
                readyState === "ready" ? "bg-green-500" : "bg-yellow-500"
              } shadow-lg`}
            />
            <span>
              {t("Ready: ", "就绪: ")}
              {readyState}
            </span>
          </div>
        </div>
        <div className="h-5 w-px bg-gray-300 dark:bg-gray-700" />
        <div className="flex items-center flex-row space-x-4">
          <button
            onClick={onToggleLang}
            className="relative inline-flex items-center w-14 h-7 rounded-full bg-gray-200/40 dark:bg-gray-800/40 backdrop-blur-md border border-white/40 dark:border-gray-700/60 shadow-inner overflow-hidden transition-colors cursor-pointer"
            title={t("Toggle Language", "切换语言")}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 shadow-[0_0_10px_rgba(56,189,248,0.5)] transform transition-transform duration-300 ease-in-out ${
                lang === "zh" ? "translate-x-0" : "translate-x-[28px]"
              }`}
            />
            <div className="absolute inset-0 flex pointer-events-none text-[10px] font-black">
              <div className="flex-1 flex items-center justify-center">
                <span
                  className={`z-10 transition-colors duration-300 ${
                    lang === "zh"
                      ? "text-white drop-shadow-md"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  中
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <span
                  className={`z-10 transition-colors duration-300 ${
                    lang === "en"
                      ? "text-white drop-shadow-md"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  EN
                </span>
              </div>
            </div>
          </button>
          <span className="text-gray-500 dark:text-gray-400">
            {t("Hi, ", "你好, ")}
            {userName || t("Admin", "管理员")}
          </span>
          <button
            onClick={onSignOut}
            className="flex items-center space-x-1 text-red-500 hover:text-red-600 transition"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
