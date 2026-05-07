"use client";

interface ApiBuilderPresetsBarProps {
  abPresets: Record<string, unknown[]>;
  loadAbPreset: (name: string) => void;
  deleteAbPreset: (name: string) => void;
  t: <T>(en: T, zh: T) => T;
}

export default function ApiBuilderPresetsBar({ abPresets, loadAbPreset, deleteAbPreset, t }: ApiBuilderPresetsBarProps) {
  if (Object.keys(abPresets).length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-gray-500">{t("Saved presets:", "已存预设:")}</span>
      {Object.keys(abPresets).map((p) => (
        <span key={p} className="inline-flex items-center gap-1 text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800">
          <button onClick={() => loadAbPreset(p)} className="hover:underline font-mono">{p}</button>
          <button onClick={() => deleteAbPreset(p)} className="text-red-400 hover:text-red-600 ml-0.5">&times;</button>
        </span>
      ))}
    </div>
  );
}
