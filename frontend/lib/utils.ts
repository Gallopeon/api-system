export function getDefaultExpiry(hours = 24): string {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString().slice(0, 16);
}

export function fmtRelativeExpiry(
  expiresAt: string | null,
): { text: string; expired: boolean } {
  if (!expiresAt) return { text: "—", expired: false };
  const diff = new Date(expiresAt).getTime() - Date.now();
  const absMin = Math.abs(Math.round(diff / 60000));
  const absH = Math.abs(Math.round(diff / 3600000));
  const absD = Math.abs(Math.round(diff / 86400000));
  if (diff < 0) {
    if (absMin < 1) return { text: "刚刚过期", expired: true };
    if (absMin < 60) return { text: `${absMin} 分钟前过期`, expired: true };
    if (absH < 24) return { text: `${absH} 小时前过期`, expired: true };
    return { text: `${absD} 天前过期`, expired: true };
  }
  if (absMin < 1) return { text: "即将过期", expired: true };
  if (absMin < 60) return { text: `${absMin} 分钟后过期`, expired: false };
  if (absH < 24) return { text: `${absH} 小时后过期`, expired: false };
  return { text: `${absD} 天后过期`, expired: false };
}

export function parseArray(input: string): string[] {
  return input.split(",").map((i) => i.trim()).filter(Boolean);
}

export function parseRenames(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  input.split("\n").map((l) => l.trim()).filter(Boolean).forEach((line) => {
    const [s, t] = line.split(":").map((i) => i.trim());
    if (s && t) out[s] = t;
  });
  return out;
}

export function formatRenames(input?: Record<string, string>): string {
  if (!input) return "";
  return Object.entries(input).map(([s, t]) => `${s}:${t}`).join("\n");
}

export function parseJson<T>(input: string, fallback: T): T {
  try {
    return input.trim() ? (JSON.parse(input) as T) : fallback;
  } catch {
    return fallback;
  }
}
