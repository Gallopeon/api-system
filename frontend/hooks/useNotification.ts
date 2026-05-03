import { useState, useCallback } from "react";

export type ToastType = "success" | "error" | "info";

interface ToastState {
  msg: string;
  type: ToastType;
}

export function useNotification() {
  const [notif, setNotif] = useState<ToastState>({ msg: "", type: "info" });

  const notifyError = useCallback(
    (msg: string) => setNotif({ msg, type: "error" }),
    [],
  );
  const notifySucc = useCallback(
    (msg: string) => setNotif({ msg, type: "success" }),
    [],
  );
  const clearNotif = useCallback(
    () => setNotif({ msg: "", type: "info" }),
    [],
  );

  return { notif, notifyError, notifySucc, clearNotif };
}
