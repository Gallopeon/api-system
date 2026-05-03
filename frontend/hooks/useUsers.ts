import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { UserResponse, UserListResponse } from "@/lib/types";

export function useUsers(
  accessToken?: string,
  notifyError?: (msg: string) => void,
  notifySucc?: (msg: string) => void,
) {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  // Create form state
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState("viewer");

  // Edit form state
  const [editUserId, setEditUserId] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");

  const loadUsers = useCallback(async () => {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (filterRole) params.set("role", filterRole);
      if (filterStatus) params.set("status", filterStatus);
      if (search) params.set("search", search);
      params.set("limit", "50");
      const r = await apiFetch(`/admin/v1/users?${params.toString()}`, undefined, accessToken);
      if (r.ok) {
        const d = (await r.json()) as UserListResponse;
        setUsers(d.items || []);
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }, [accessToken, filterRole, filterStatus, search]);

  const createUser = useCallback(async () => {
    if (!newUsername || !newPassword) {
      notifyError?.("Username and password are required");
      return;
    }
    setBusy(true);
    try {
      const r = await apiFetch("/admin/v1/users", {
        method: "POST",
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          email: newEmail || undefined,
          display_name: newDisplayName || undefined,
          role: newRole,
        }),
      }, accessToken);
      if (!r.ok) throw new Error((await r.json())?.message || "Create failed");
      notifySucc?.("User created");
      setNewUsername("");
      setNewPassword("");
      setNewEmail("");
      setNewDisplayName("");
      setNewRole("viewer");
      await loadUsers();
    } catch (e) {
      notifyError?.((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [newUsername, newPassword, newEmail, newDisplayName, newRole, accessToken, loadUsers, notifyError, notifySucc]);

  const updateUser = useCallback(
    async (userId: string) => {
      setBusy(true);
      try {
        const body: Record<string, string> = {};
        if (editRole) body.role = editRole;
        if (editStatus) body.status = editStatus;
        if (editDisplayName) body.display_name = editDisplayName;
        const r = await apiFetch(`/admin/v1/users/${userId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        }, accessToken);
        if (!r.ok) throw new Error((await r.json())?.message || "Update failed");
        notifySucc?.("User updated");
        setEditUserId("");
        setEditRole("");
        setEditStatus("");
        setEditDisplayName("");
        await loadUsers();
      } catch (e) {
        notifyError?.((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [editRole, editStatus, editDisplayName, accessToken, loadUsers, notifyError, notifySucc],
  );

  const deleteUser = useCallback(
    async (userId: string) => {
      if (!confirm("Delete this user permanently?")) return;
      setBusy(true);
      try {
        const r = await apiFetch(`/admin/v1/users/${userId}`, {
          method: "DELETE",
        }, accessToken);
        if (!r.ok) throw new Error((await r.json())?.message || "Delete failed");
        notifySucc?.("User deleted");
        await loadUsers();
      } catch (e) {
        notifyError?.((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadUsers, notifyError, notifySucc],
  );

  return {
    users, busy, filterRole, filterStatus, search,
    setFilterRole, setFilterStatus, setSearch,
    newUsername, newPassword, newEmail, newDisplayName, newRole,
    setNewUsername, setNewPassword, setNewEmail, setNewDisplayName, setNewRole,
    editUserId, editRole, editStatus, editDisplayName,
    setEditUserId, setEditRole, setEditStatus, setEditDisplayName,
    loadUsers, createUser, updateUser, deleteUser,
  };
}
