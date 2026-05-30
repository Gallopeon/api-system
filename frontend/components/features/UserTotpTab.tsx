"use client";

import { useState } from "react";
import { AlertTriangle, Check, OctagonX, Shield, ShieldCheck, X } from "lucide-react";
import { cardClass, inputClass, btnPrimary } from "@/lib/constants";

interface Props {
  totpEnabled: boolean;
  totpSecret: string | null;
  totpQrUrl: string | null;
  totpBusy: boolean;
  totpCode: string;
  setTotpCode: (v: string) => void;
  setupTotp: () => void;
  verifyTotp: (code: string) => void;
  disableTotp: () => void;
  t: <T>(en: T, zh: T) => T;
}

export default function UserTotpTab({
  totpEnabled, totpSecret, totpQrUrl, totpBusy, totpCode, setTotpCode,
  setupTotp, verifyTotp, disableTotp, t,
}: Props) {
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  return (
    <div className={cardClass}>
      <h2 className="text-lg font-semibold mb-4">{t("Two-Factor Authentication", "两步验证")}</h2>

      {totpEnabled ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-semibold text-sm text-green-800 dark:text-green-200">
                {t("Two-factor authentication is active", "两步验证已启用")}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                {t("Your account is protected with an authenticator app", "您的账户已通过认证器应用获得额外保护")}
              </p>
            </div>
          </div>

          {!showDisableConfirm ? (
            <button
              onClick={() => setShowDisableConfirm(true)}
              disabled={totpBusy}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-medium text-sm hover:bg-red-100 dark:hover:bg-red-950/40 hover:border-red-300 dark:hover:border-red-800 transition-all"
            >
              <OctagonX className="w-4 h-4" />
              {t("Disable Two-Factor Authentication", "禁用两步验证")}
            </button>
          ) : (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-amber-800 dark:text-amber-200">
                    {t("Are you sure?", "确定要禁用吗？")}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    {t("Disabling 2FA will remove an important security layer from your account. Anyone with your password will be able to sign in.", "禁用两步验证将移除账户的重要安全保护层，任何拥有您密码的人都可以登录。")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { disableTotp(); setShowDisableConfirm(false); }}
                  disabled={totpBusy}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-all disabled:opacity-60"
                >
                  <Check className="w-4 h-4" />
                  {t("Yes, disable 2FA", "确认禁用")}
                </button>
                <button
                  onClick={() => setShowDisableConfirm(false)}
                  disabled={totpBusy}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-black/50 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                >
                  <X className="w-4 h-4" />
                  {t("Cancel", "取消")}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : totpSecret ? (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-3">
              {t("Scan this QR code with your authenticator app:", "使用认证器 App 扫描此二维码：")}
            </p>
            <div className="flex justify-center">
              {totpQrUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={totpQrUrl} alt="TOTP QR Code" className="w-48 h-48 rounded-xl border-2 border-blue-200 dark:border-blue-700 bg-white p-2" />
                </>
              ) : (
                <div className="w-48 h-48 border-2 border-dashed border-blue-200 dark:border-blue-700 rounded-xl bg-blue-50 dark:bg-blue-900/10 flex items-center justify-center">
                  <p className="text-xs text-blue-400 text-center p-4">
                    {t("Loading QR code...", "正在加载二维码...")}
                  </p>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center break-all font-mono bg-white dark:bg-black/20 rounded-lg px-3 py-2 border border-gray-100 dark:border-gray-800">
              {t("Secret key:", "密钥：")} {totpSecret}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="totp-verify-code" className="sr-only">{t("Verification Code", "验证码")}</label>
            <input
              id="totp-verify-code"
              name="totp-verify-code"
              className={`${inputClass} flex-1`}
              placeholder="000000"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
            />
            <button onClick={() => verifyTotp(totpCode)} disabled={totpBusy || totpCode.length !== 6} className={`${btnPrimary} px-6`}>
              {t("Verify", "验证")}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t("Add an extra layer of security to your account by enabling two-factor authentication.", "通过启用两步验证为您的账户添加额外安全保护层。")}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {t("You'll need an authenticator app like Google Authenticator or Authy.", "您需要一个认证器应用，如 Google Authenticator 或 Authy。")}
              </p>
            </div>
          </div>
          <button onClick={setupTotp} disabled={totpBusy} className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/20 disabled:opacity-60">
            <Shield className="w-4 h-4" />
            {t("Set Up Two-Factor Authentication", "设置两步验证")}
          </button>
        </div>
      )}
    </div>
  );
}
