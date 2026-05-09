"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { signIn } from "next-auth/react";
import { ArrowLeft, Check, KeyRound, Loader2, Network, ShieldAlert, User } from "lucide-react";

interface LoginPageProps {
  t: <T>(en: T, zh: T) => T;
}

function TotpInput({ onSubmit, loading, t }: { onSubmit: (code: string) => void; loading: boolean; t: LoginPageProps["t"] }) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [submitted, setSubmitted] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const focusFirstInput = useCallback(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => focusFirstInput());
    const fallback = setTimeout(() => focusFirstInput(), 100);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
    };
  }, [focusFirstInput]);

  const handleChange = useCallback((index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [digits]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [digits]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill("");
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  }, []);

  const code = digits.join("");
  const complete = code.length === 6;

  useEffect(() => {
    if (complete && !loading && !submitted) {
      setSubmitted(true);
      const timer = setTimeout(() => onSubmitRef.current(code), 200);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, loading]);

  // Reset submitted flag when loading changes (allows retry after error)
  useEffect(() => {
    if (!loading && submitted) {
      setDigits(Array(6).fill(""));
      setSubmitted(false);
      focusFirstInput();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
        {t("Enter the 6-digit code from your authenticator app", "请输入认证器 App 中的 6 位验证码")}
      </p>
      <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus={i === 0}
            maxLength={1}
            value={digit}
            disabled={submitted}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="w-11 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-black/50 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all shadow-sm text-gray-900 dark:text-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          />
        ))}
      </div>
      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-blue-600 dark:text-blue-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("Verifying...", "验证中...")}
        </div>
      )}
    </div>
  );
}

export default function LoginPage({ t }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"credentials" | "totp">("credentials");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const handleCredentials = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoading(true);
    const res = await signIn("credentials", {
      redirect: false,
      username,
      password,
    });
    setLoading(false);
    if (!res?.error) {
      if (res?.ok) window.location.reload();
      return;
    }
    if (res.error === "totp_required") {
      setTransitioning(true);
      setTimeout(() => {
        setStep("totp");
        setTransitioning(false);
      }, 150);
    } else {
      setLoginError(t("Invalid username or password", "用户名或密码无效"));
    }
  }, [username, password, t]);

  const handleTotp = useCallback(async (code: string) => {
    setLoginError("");
    setLoading(true);
    const res = await signIn("credentials", {
      redirect: false,
      username,
      password,
      totp_code: code,
    });
    setLoading(false);
    if (!res?.error) {
      if (res?.ok) window.location.reload();
      return;
    }
    setLoginError(t("Invalid verification code", "验证码无效"));
  }, [username, password, t]);

  const goBack = useCallback(() => {
    setTransitioning(true);
    setTimeout(() => {
      setStep("credentials");
      setLoginError("");
      setTransitioning(false);
    }, 150);
  }, []);

  const sidebar = (
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
  );

  return (
    <div className="min-h-screen flex bg-white dark:bg-zinc-950 font-sans text-gray-900 dark:text-gray-100">
      {sidebar}
      <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-950 relative border-l border-white/10">
        <div className="w-full max-w-md">
          <div className="md:hidden flex items-center space-x-3 mb-10 justify-center">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20"><Network className="w-6 h-6 text-white" /></div>
            <span className="font-bold tracking-tight text-2xl">{t("API Control", "API 控制")}</span>
          </div>

          {/* Step 1: Credentials */}
          <div className={`transition-all duration-300 ${step === "totp" ? "hidden" : ""} ${transitioning && step === "credentials" ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
            <div className="mb-10 text-center md:text-left">
              <h2 className="text-3xl font-bold tracking-tight mb-2">{t("Welcome Back", "欢迎回来")}</h2>
              <p className="text-gray-500 dark:text-gray-400">{t("Please enter your credentials to access the workspace.", "请输入您的凭据即可访问控制台。")}</p>
            </div>
            <form onSubmit={handleCredentials} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t("Work Email / Username", "工作邮箱 / 用户名")}</label>
                <input type="text" className="w-full pl-4 pr-4 py-3 bg-white dark:bg-black/50 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all shadow-sm" placeholder={t("admin", "admin")} value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t("Password", "登录密码")}</label>
                <input type="password" className="w-full pl-4 pr-4 py-3 bg-white dark:bg-black/50 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all shadow-sm" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              {loginError && (
                <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-start space-x-2">
                  <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-red-700 dark:text-red-400 text-sm font-medium">{loginError}</p>
                </div>
              )}
              <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center rounded-xl px-4 py-3.5 font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg shadow-blue-600/30 mt-4 disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t("Signing in...", "登录中...")}</>
                ) : (
                  t("Sign In to Dashboard", "登录到控制台")
                )}
              </button>
            </form>
          </div>

          {/* Step 2: TOTP Verification */}
          <div className={`transition-all duration-300 ${step === "credentials" ? "hidden" : ""} ${transitioning && step === "totp" ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
            <div className="mb-8">
              <button onClick={goBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-6">
                <ArrowLeft className="w-4 h-4" />
                {t("Back", "返回")}
              </button>
              <div className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4 ring-4 ring-blue-50 dark:ring-blue-900/10">
                  <User className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight mb-1">{t("Two-Factor Authentication", "两步验证")}</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {t(`Signing in as`, "正在登录为")} <span className="font-semibold text-gray-900 dark:text-gray-100">{username}</span>
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-black/30 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5 pb-5 border-b border-gray-100 dark:border-gray-800">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{t("Verification Code", "验证码")}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t("from your authenticator app", "来自您的认证器应用")}</p>
                </div>
              </div>
              {step === "totp" ? (
                <TotpInput onSubmit={handleTotp} loading={loading} t={t} />
              ) : (
                <div className="py-6 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-300 dark:text-gray-600" />
                </div>
              )}
            </div>

            {loginError && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-start space-x-2">
                <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-red-700 dark:text-red-400 text-sm font-medium">{loginError}</p>
              </div>
            )}
          </div>

          <div className="mt-8 text-center text-sm font-medium text-gray-400 dark:text-gray-500">{t("Authorized personnel only.", "仅限授权人员访问。")}</div>
        </div>
      </div>
    </div>
  );
}
