import Image from "next/image";
import { cardClass, inputClass, labelClass, btnPrimary } from "@/lib/constants";
import type { UserResponse } from "@/lib/types";

interface Props {
  profile: UserResponse | null;
  profileBusy: boolean;
  editDisplayName: string;
  setEditDisplayName: (v: string) => void;
  editEmail: string;
  setEditEmail: (v: string) => void;
  editAvatarUrl: string;
  setEditAvatarUrl: (v: string) => void;
  onSave: () => void;
  t: <T>(en: T, zh: T) => T;
}

export default function UserProfileTab({
  profile, profileBusy, editDisplayName, setEditDisplayName, editEmail, setEditEmail,
  editAvatarUrl, setEditAvatarUrl, onSave, t,
}: Props) {
  if (!profile) return (
    <div className={cardClass}>
      <h2 className="text-lg font-semibold mb-4">{t("Profile Information", "个人信息")}</h2>
      <p className="text-gray-400">{t("Loading...", "加载中...")}</p>
    </div>
  );

  return (
    <div className={cardClass}>
      <h2 className="text-lg font-semibold mb-4">{t("Profile Information", "个人信息")}</h2>
      <div className="space-y-4">
        <div className="flex items-center space-x-4 mb-6">
          {profile.avatar_url ? (
            <Image src={profile.avatar_url} alt="" width={64} height={64} className="w-16 h-16 rounded-full object-cover" unoptimized />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {(profile.display_name || profile.username).charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <div className="font-semibold text-lg">{profile.display_name || profile.username}</div>
            <div className="text-sm text-gray-500">@{profile.username} · {t("Role:", "角色：")} {profile.role}</div>
          </div>
        </div>
        <div>
          <label className={labelClass}>{t("Display Name", "显示名称")}</label>
          <input className={inputClass} value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("Email", "邮箱")}</label>
          <input className={inputClass} type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("Avatar URL", "头像链接")}</label>
          <input className={inputClass} value={editAvatarUrl} onChange={(e) => setEditAvatarUrl(e.target.value)} placeholder="https://..." />
        </div>
        <button onClick={onSave} disabled={profileBusy} className={btnPrimary}>
          {t("Save Changes", "保存更改")}
        </button>
      </div>
    </div>
  );
}
