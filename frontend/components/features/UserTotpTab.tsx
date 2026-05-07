"use client";

import { Shield } from "lucide-react";
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
  return (
    <div className={cardClass}>
      <h2 className="text-lg font-semibold mb-4">{t("Two-Factor Authentication", "两步验证")}</h2>
      {totpEnabled ? (
        <div>
          <div className="flex items-center space-x-2 mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <Shield className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              {t("2FA is enabled", "两步验证已启用")}
            </span>
          </div>
          <button onClick={disableTotp} disabled={totpBusy} className="text-red-500 hover:text-red-700 font-medium text-sm">
            {t("Disable 2FA", "禁用两步验证")}
          </button>
        </div>
      ) : totpSecret ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t("Scan this QR code with your authenticator app:", "使用认证器 App 扫描此二维码：")}
            </p>
            {totpQrUrl ? (
              <img src={totpQrUrl} alt="TOTP QR Code" className="w-48 h-48 rounded-lg border" />
            ) : (
              <div className="w-48 h-48 border rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <p className="text-xs text-gray-500 text-center p-4">
                  {t("Loading QR code...", "正在加载二维码...")}
                </p>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2 break-all font-mono">
              {t("Secret key:", "密钥：")} {totpSecret}
            </p>
          </div>
          <div className="flex items-center space-x-2 max-w-xs">
            <input
              className={inputClass}
              placeholder="000000"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
            />
            <button onClick={() => verifyTotp(totpCode)} disabled={totpBusy || totpCode.length !== 6} className={btnPrimary}>
              {t("Verify", "验证")}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            {t("Add an extra layer of security to your account by enabling two-factor authentication.", "通过启用两步验证为您的账户添加额外安全保护层。")}
          </p>
          <button onClick={setupTotp} disabled={totpBusy} className={btnPrimary}>
            <Shield className="w-4 h-4 mr-2" />
            {t("Set Up 2FA", "设置两步验证")}
          </button>
        </div>
      )}
    </div>
  );
}
