"use client";

import { useEffect } from "react";
import { AlertTriangle, Check, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  msg: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export default function Toast({
  msg,
  type,
  onClose,
  duration = 5000,
}: ToastProps) {
  useEffect(() => {
    if (!msg) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [msg, onClose, duration]);

  if (!msg) return null;

  const bg =
    type === "error"
      ? "bg-red-50 text-red-700 border border-red-200"
      : "bg-green-50 text-green-700 border border-green-200";

  return (
    <div
      className={`absolute top-4 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 max-w-sm z-50 animate-in fade-in slide-in-from-top-4 ${bg}`}
    >
      {type === "error" ? (
        <AlertTriangle className="w-5 h-5" />
      ) : (
        <Check className="w-5 h-5" />
      )}
      <span className="text-sm font-medium">{msg}</span>
      <button
        onClick={onClose}
        className="ml-auto opacity-70 hover:opacity-100 text-lg"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
