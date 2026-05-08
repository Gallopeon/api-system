"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { Check, Network, ShieldAlert } from "lucide-react";

interface LoginPageProps {
  t: <T>(en: T, zh: T) => T;
}

export default function LoginPage({ t }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [requireTotp, setRequireTotp] = useState(false);
  const [loginError, setLoginError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    const res = await signIn("credentials", {
      redirect: false,
      username,
      password,
      ...(totpCode ? { totp_code: totpCode } : {}),
    });
    if (!res?.error) {
      if (res?.ok) window.location.reload();
      return;
    }
    if (res.error === "totp_required") {
      setRequireTotp(true);
      setLoginError(t("Enter the 6-digit code from your authenticator app", "请输入认证器 App 中的 6 位验证码"));
    } else {
      setLoginError(t("Invalid username or password", "用户名或密码无效"));
    }
  };

  return (
    <div className="min-h-screen flex bg-white dark:bg-zinc-950 font-sans text-gray-900 dark:text-gray-100">
      <div className="hidden md:flex w-1/2 lg:w-3/5 flex-col justify-between bg-gradient-to-br from-blue-900 to-black p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-overlay" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2670&auto=format&fit=crop')" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="relative z-10 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Network className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold tracking-tight text-xl">{t("API Control Center", "API 控制中心")}</span>
        </div>
        <div className="relative z-10 max-w-lg">
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-6 leading-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-300">
            {t("Control, filter, and observe your APIs at scale.", "大规模控制、过滤和观察您的 API。")}
          </h1>
          <p className="text-blue-200 text-lg mb-8 leading-relaxed font-light">
            {t("Log in to access the control plane dashboard, orchestrate rules instantly, and monitor global latency—all in one secured place.", "登录以访问控制平面仪表板，即时编排规则并监控全球延迟——所有操作都在一个安全的平台上完成。")}
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-blue-300 font-medium">
            <span className="flex items-center bg-white/5 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10"><Check className="w-4 h-4 mr-1.5 text-emerald-400" /> {t("Enterprise Grade", "企业级")}</span>
            <span className="flex items-center bg-white/5 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10"><Check className="w-4 h-4 mr-1.5 text-emerald-400" /> {t("Zero Trust Built-in", "内置零信任")}</span>
            <span className="flex items-center bg-white/5 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10"><Check className="w-4 h-4 mr-1.5 text-emerald-400" /> {t("Real-time Config Propagation", "实时配置同步")}</span>
          </div>
        </div>
      </div>
      <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-950 relative border-l border-white/10">
        <div className="w-full max-w-md">
          <div className="md:hidden flex items-center space-x-3 mb-10 justify-center">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20"><Network className="w-6 h-6 text-white" /></div>
            <span className="font-bold tracking-tight text-2xl">{t("API Control", "API 控制")}</span>
          </div>
          <div className="mb-10 text-center md:text-left">
            <h2 className="text-3xl font-bold tracking-tight mb-2">{t("Welcome Back", "欢迎回来")}</h2>
            <p className="text-gray-500 dark:text-gray-400">{t("Please enter your credentials to access the workspace.", "请输入您的凭据即可访问控制台。")}</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t("Work Email / Username", "工作邮箱 / 用户名")}</label>
              <input type="text" className="w-full pl-4 pr-4 py-3 bg-white dark:bg-black/50 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all shadow-sm" placeholder={t("admin", "admin")} value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t("Password", "登录密码")}</label>
              <input type="password" className="w-full pl-4 pr-4 py-3 bg-white dark:bg-black/50 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all shadow-sm" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {requireTotp && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t("TOTP Code", "两步验证码")}</label>
                <input type="text" className="w-full pl-4 pr-4 py-3 bg-white dark:bg-black/50 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all shadow-sm" placeholder="000000" maxLength={6} value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))} required />
              </div>
            )}
            {loginError && (
              <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-start space-x-2">
                <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-red-700 dark:text-red-400 text-sm font-medium">{loginError}</p>
              </div>
            )}
            <button type="submit" className="w-full inline-flex items-center justify-center rounded-xl px-4 py-3.5 font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg shadow-blue-600/30 mt-4">
              {t("Sign In to Dashboard", "登录到控制台")}
            </button>
          </form>
          <div className="mt-8 text-center text-sm font-medium text-gray-400 dark:text-gray-500">{t("Authorized personnel only.", "仅限授权人员访问。")}</div>
        </div>
      </div>
    </div>
  );
}
