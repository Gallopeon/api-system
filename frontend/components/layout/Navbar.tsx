"use client";

import { useState, useRef, useEffect } from "react";
import { Network, LogOut, Menu, UserCircle, ChevronDown, Settings, Shield } from "lucide-react";
import NotificationCenter from "@/components/features/NotificationCenter";

interface NavbarProps {
  liveState: string;
  readyState: string;
  accessToken?: string;
  lang: string;
  onToggleLang: () => void;
  userName: string;
  userEmail?: string;
  onSignOut: () => void;
  onToggleSidebar: () => void;
  onMenuSelect: (menu: string) => void;
  t: <T>(en: T, zh: T) => T;
}

function HealthDot({ state, ok }: { state: string; ok: string }) {
  const green = state === ok;
  const yellow = !green && state !== "error";
  return (
    <div
      className={`w-2 h-2 rounded-full shadow-lg flex-shrink-0 ${
        green
          ? "bg-green-500 shadow-green-500/30"
          : yellow
          ? "bg-yellow-500 shadow-yellow-500/30"
          : "bg-red-500 shadow-red-500/30"
      }`}
    />
  );
}

export default function Navbar({
  liveState,
  readyState,
  accessToken,
  lang,
  onToggleLang,
  userName,
  userEmail,
  onSignOut,
  onToggleSidebar,
  onMenuSelect,
  t,
}: NavbarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const displayName = userName || t("Admin", "管理员");

  return (
    <nav className="h-14 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-4 lg:px-6">
      {/* Left: hamburger + brand */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors touch-btn"
          aria-label={t("Toggle menu", "切换菜单")}
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
          <Network className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold tracking-tight text-base lg:text-lg hidden sm:inline">
          {t("API Control Center", "API 控制中心")}
        </span>
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 hidden md:inline">
          {t(process.env.NEXT_PUBLIC_ENV_LABEL || "prod-zone-1", process.env.NEXT_PUBLIC_ENV_LABEL || "生产区-1")}
        </span>
      </div>

      {/* Right: health, lang, user dropdown, notifications */}
      <div className="flex items-center space-x-3 lg:space-x-5 text-sm font-medium">
        {/* Health indicators */}
        <div className="hidden sm:flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <HealthDot state={liveState} ok="ok" />
            <span className="hidden md:inline text-xs lg:text-sm">
              {liveState === "ok" ? t("Live", "存活") : t("Down", "异常")}
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <HealthDot state={readyState} ok="ready" />
            <span className="hidden md:inline text-xs lg:text-sm">
              {readyState === "ready" ? t("Ready", "就绪") : t("Busy", "忙碌")}
            </span>
          </div>
        </div>
        <div className="flex sm:hidden items-center space-x-1.5">
          <HealthDot state={liveState} ok="ok" />
          <HealthDot state={readyState} ok="ready" />
        </div>

        <div className="h-5 w-px bg-gray-300 dark:bg-zinc-700 hidden sm:block" />

        {/* Language toggle */}
        <button
          onClick={onToggleLang}
          className="relative inline-flex items-center w-12 h-6 lg:w-14 lg:h-7 rounded-full bg-gray-200/40 dark:bg-zinc-800/40 backdrop-blur-md border border-white/40 dark:border-zinc-700/60 shadow-inner overflow-hidden transition-colors cursor-pointer flex-shrink-0"
          title={t("Toggle Language", "切换语言")}
        >
          <div
            className={`absolute top-0.5 left-0.5 w-5 h-5 lg:w-6 lg:h-6 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 shadow-[0_0_10px_rgba(56,189,248,0.5)] transition-transform duration-300 ease-in-out ${
              lang === "zh" ? "translate-x-0" : "translate-x-[22px] lg:translate-x-[28px]"
            }`}
          />
          <div className="absolute inset-0 flex pointer-events-none text-[9px] lg:text-[10px] font-black">
            <div className="flex-1 flex items-center justify-center">
              <span className={`z-10 transition-colors duration-300 ${lang === "zh" ? "text-white drop-shadow-md" : "text-gray-500 dark:text-zinc-400"}`}>中</span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <span className={`z-10 transition-colors duration-300 ${lang === "en" ? "text-white drop-shadow-md" : "text-gray-500 dark:text-zinc-400"}`}>EN</span>
            </div>
          </div>
        </button>

        {/* User dropdown */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            className="hidden sm:inline-flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 transition-all shadow-sm text-xs lg:text-sm font-medium whitespace-nowrap"
            type="button"
          >
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <UserCircle className="w-4 h-4 text-white" />
            </div>
            <span className="max-w-[120px] truncate text-gray-700 dark:text-zinc-200">{displayName}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-xl z-50 overflow-hidden animate-scale-in origin-top-right">
              {/* User info header */}
              <div className="px-4 py-4 border-b border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                    <span className="text-white font-bold text-base">{displayName.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{displayName}</div>
                    {userEmail && (
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">{userEmail}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-2 space-y-0.5">
                <button
                  onClick={() => { onMenuSelect("user-center"); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                  {t("User Center", "用户中心")}
                </button>
                <button
                  onClick={() => { setOpen(false); onSignOut(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  {t("Sign Out", "退出登录")}
                </button>
              </div>
            </div>
          )}
        </div>

        <NotificationCenter accessToken={accessToken} t={t} />
      </div>
    </nav>
  );
}
