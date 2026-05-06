"use client";

import { cardClass, inputClass, labelClass, btnPrimary } from "@/lib/constants";

interface Props {
  currentPassword: string;
  setCurrentPassword: (v: string) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  profileBusy: boolean;
  onChangePassword: () => void;
  t: <T>(en: T, zh: T) => T;
}

export default function UserSecurityTab({
  currentPassword, setCurrentPassword, newPassword, setNewPassword,
  confirmPassword, setConfirmPassword, profileBusy, onChangePassword, t,
}: Props) {
  return (
    <div className={cardClass}>
      <h2 className="text-lg font-semibold mb-4">{t("Change Password", "修改密码")}</h2>
      <div className="space-y-4 max-w-md">
        <div>
          <label className={labelClass}>{t("Current Password", "当前密码")}</label>
          <input className={inputClass} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("New Password", "新密码")}</label>
          <input className={inputClass} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <p className="text-xs text-gray-400 mt-1">{t("Min 8 chars, uppercase, lowercase, digit", "至少8位，含大写、小写、数字")}</p>
        </div>
        <div>
          <label className={labelClass}>{t("Confirm New Password", "确认新密码")}</label>
          <input className={inputClass} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        <button onClick={onChangePassword} disabled={profileBusy} className={btnPrimary}>
          {t("Update Password", "更新密码")}
        </button>
      </div>
    </div>
  );
}
