"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useCsrfFetch } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import type { User, UserRole, UserStatus } from "@/types";

const MAX_NOTE_LENGTH = 5000;

type AdminUserListItem = User & {
  recentDevice: {
    label: string;
    lastSeenAt: string;
  } | null;
};

type ActivityData = {
  user: { id: string; email: string; nickname: string; name: string; role: string };
  readingStats: {
    uniqueDocs: number;
    totalReads: number;
    totalTimeSec: number;
    firstReadAt: string | null;
    lastReadAt: string | null;
  };
  activityLogs: {
    id: string;
    action: string;
    detail: string;
    ip_address: string | null;
    created_at: string;
  }[];
  auditLogs: {
    id: string;
    action: string;
    target_type: string;
    target_id: string | null;
    detail: string;
    created_at: string;
  }[];
};

type SortField = "email" | "name" | "role" | "status" | "createdAt" | "lastLoginAt";
type SortDir = "asc" | "desc";

export default function AdminUsersPage() {
  const router = useRouter();
  const { user: currentUser, isAdmin, isLoading } = useAuth();
  const csrfFetch = useCsrfFetch();

  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Sort
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Modals
  const [editingUser, setEditingUser] = useState<AdminUserListItem | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    userId: string;
    action: string;
    label: string;
  } | null>(null);

  // Create form
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("user");
  const [newNotes, setNewNotes] = useState("");

  // Edit form
  const [editRole, setEditRole] = useState<UserRole>("user");
  const [editNotes, setEditNotes] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [activityUserId, setActivityUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace("/library");
      return;
    }
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, isLoading, router, fetchUsers]);

  // Filter and sort users
  const filteredUsers = users
    .filter((u) => {
      if (filterStatus !== "all" && u.status !== filterStatus) return false;
      if (filterRole !== "all" && u.role !== filterRole) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          u.email.toLowerCase().includes(q) ||
          u.name.toLowerCase().includes(q) ||
          u.nickname.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleCreateUser = async () => {
    if (!newEmail.trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await csrfFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          role: newRole,
          adminNotes: newNotes,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create user");
        return;
      }
      setCreatingUser(false);
      setNewEmail("");
      setNewRole("user");
      setNewNotes("");
      await fetchUsers();
    } catch {
      setError("Failed to create user");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    if (
      editRole !== editingUser.role &&
      !window.confirm(
        `Change ${editingUser.nickname || editingUser.name || editingUser.email} to ${editRole}?`
      )
    ) {
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await csrfFetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editRole,
          adminNotes: editNotes,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update user");
        return;
      }
      setEditingUser(null);
      await fetchUsers();
    } catch {
      setError("Failed to update user");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = async (userId: string, action: string) => {
    setActionLoading(true);
    setError(null);
    try {
      let res: Response;
      switch (action) {
        case "delete":
          res = await csrfFetch(`/api/admin/users/${userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "deleted" }),
          });
          break;
        case "suspend":
          res = await csrfFetch(`/api/admin/users/${userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "inactive" }),
          });
          break;
        case "restore":
          res = await csrfFetch(`/api/admin/users/${userId}/restore`, {
            method: "POST",
          });
          break;
        case "force-logout":
          res = await csrfFetch(`/api/admin/users/${userId}/force-logout`, {
            method: "POST",
          });
          break;
        default:
          return;
      }
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || `Failed to ${action} user`);
        return;
      }
      setConfirmAction(null);
      await fetchUsers();
    } catch {
      setError(`Failed to ${action} user`);
    } finally {
      setActionLoading(false);
    }
  };

  const openEdit = (u: AdminUserListItem) => {
    setEditingUser(u);
    setEditRole(u.role);
    setEditNotes(u.adminNotes ?? "");
  };

  const isSelf = (u: User) => u.id === currentUser?.id;

  const statusBadge = (status: UserStatus) => {
    const map: Record<UserStatus, string> = {
      active: "bg-green-100 text-green-700",
      inactive: "bg-yellow-100 text-yellow-700",
      deleted: "bg-red-100 text-red-700",
      pending_verification: "bg-blue-100 text-blue-700",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-gray-100"}`}>
        {status}
      </span>
    );
  };

  const roleBadge = (role: UserRole) => (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        role === "admin"
          ? "bg-amber-100 text-amber-700"
          : "bg-gray-100 text-gray-600"
      }`}
    >
      {role}
    </span>
  );

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <Button variant="primary" onClick={() => setCreatingUser(true)}>
          + Add User
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search email, name..."
          className="rounded-xl border-2 border-gray-200 px-3 py-2 text-sm w-64"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="rounded-xl border-2 border-gray-200 px-3 py-2 text-sm bg-white"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="deleted">Deleted</option>
          <option value="pending_verification">Pending</option>
        </select>
        <select
          className="rounded-xl border-2 border-gray-200 px-3 py-2 text-sm bg-white"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border-2 border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left font-medium">Avatar</th>
              <SortHeader field="name" label="Nickname" current={sortField} dir={sortDir} toggle={toggleSort} />
              <th className="px-3 py-3 text-left font-medium">Google Name</th>
              <SortHeader field="email" label="Email" current={sortField} dir={sortDir} toggle={toggleSort} />
              <SortHeader field="role" label="Role" current={sortField} dir={sortDir} toggle={toggleSort} />
              <SortHeader field="status" label="Status" current={sortField} dir={sortDir} toggle={toggleSort} />
              <th className="px-3 py-3 text-left font-medium">Admin Notes</th>
              <SortHeader field="createdAt" label="Created" current={sortField} dir={sortDir} toggle={toggleSort} />
              <SortHeader field="lastLoginAt" label="Last Login" current={sortField} dir={sortDir} toggle={toggleSort} />
              <th className="px-3 py-3 text-left font-medium">Recent Device</th>
              <th className="px-3 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr
                key={u.id}
                className="border-t border-gray-100 hover:bg-gray-50/50 cursor-pointer"
                onClick={() => setActivityUserId(u.id)}
              >
                <td className="px-3 py-3">
                  {u.avatarUrl ? (
                    <img
                      src={u.avatarUrl}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                      {(u.nickname || u.name || u.email)[0]?.toUpperCase()}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="font-medium">{u.nickname || "—"}</div>
                </td>
                <td className="px-3 py-3 text-gray-600">{u.name || "—"}</td>
                <td className="px-3 py-3 text-gray-600">{u.email}</td>
                <td className="px-3 py-3">{roleBadge(u.role)}</td>
                <td className="px-3 py-3">{statusBadge(u.status)}</td>
                <td className="px-3 py-3 max-w-[200px] truncate text-gray-500" title={u.adminNotes ?? ""}>
                  {u.adminNotes || "—"}
                </td>
                <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                </td>
                <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}
                </td>
                <td className="px-3 py-3 text-gray-500">
                  {u.recentDevice ? (
                    <div>
                      <div className="max-w-[220px] truncate" title={u.recentDevice.label}>
                        {u.recentDevice.label}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(u.recentDevice.lastSeenAt).toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1 flex-wrap">
                    <button
                      className="px-2 py-1 text-xs rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
                      onClick={() => openEdit(u)}
                    >
                      Edit
                    </button>
                    {u.status === "active" && !isSelf(u) && (
                      <button
                        className="px-2 py-1 text-xs rounded-lg bg-yellow-50 text-yellow-600 hover:bg-yellow-100"
                        onClick={() =>
                          setConfirmAction({
                            userId: u.id,
                            action: "suspend",
                            label: `Suspend ${u.nickname || u.name}?`,
                          })
                        }
                      >
                        Suspend
                      </button>
                    )}
                    {(u.status === "inactive" || u.status === "deleted") && (
                      <button
                        className="px-2 py-1 text-xs rounded-lg bg-green-50 text-green-600 hover:bg-green-100"
                        onClick={() =>
                          setConfirmAction({
                            userId: u.id,
                            action: "restore",
                            label: `Restore ${u.nickname || u.name}?`,
                          })
                        }
                      >
                        Restore
                      </button>
                    )}
                    {u.status !== "deleted" && !isSelf(u) && (
                      <button
                        className="px-2 py-1 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                        onClick={() =>
                          setConfirmAction({
                            userId: u.id,
                            action: "delete",
                            label: `Delete ${u.nickname || u.name}?`,
                          })
                        }
                      >
                        Delete
                      </button>
                    )}
                    {u.status === "active" && (
                      <button
                        className="px-2 py-1 text-xs rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100"
                        onClick={() =>
                          setConfirmAction({
                            userId: u.id,
                            action: "force-logout",
                            label: `Force logout ${u.nickname || u.name}?`,
                          })
                        }
                      >
                        Logout
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-gray-400">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-2">
        Showing {filteredUsers.length} of {users.length} users
      </p>

      {/* Create User Dialog */}
      {creatingUser && (
        <Dialog onClose={() => setCreatingUser(false)} title="Add User">
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Email *</label>
              <input
                type="email"
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Role</label>
              <select
                className="rounded-xl border-2 border-gray-200 px-3 py-2 text-sm bg-white"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Admin Notes</label>
              <textarea
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm resize-y"
                rows={3}
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                maxLength={MAX_NOTE_LENGTH}
              />
              <p className="text-xs text-gray-400 mt-1">{newNotes.length}/{MAX_NOTE_LENGTH}</p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setCreatingUser(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void handleCreateUser()} disabled={actionLoading || !newEmail.trim()}>
                {actionLoading ? "Creating..." : "Create User"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Edit User Dialog */}
      {editingUser && (
        <Dialog onClose={() => setEditingUser(null)} title={`Edit: ${editingUser.nickname || editingUser.name}`}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Email</label>
              <p className="text-sm text-gray-600">{editingUser.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Role</label>
              <select
                className="rounded-xl border-2 border-gray-200 px-3 py-2 text-sm bg-white"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                disabled={isSelf(editingUser)}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              {isSelf(editingUser) && (
                <p className="text-xs text-amber-500 mt-1">Cannot change your own role</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Admin Notes</label>
              <textarea
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm resize-y"
                rows={4}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                maxLength={MAX_NOTE_LENGTH}
              />
              <p className="text-xs text-gray-400 mt-1">{editNotes.length}/{MAX_NOTE_LENGTH}</p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void handleUpdateUser()} disabled={actionLoading}>
                {actionLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Confirm Action Dialog */}
      {confirmAction && (
        <Dialog onClose={() => setConfirmAction(null)} title="Confirm Action">
          <p className="text-sm mb-4">{confirmAction.label}</p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <button
              className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50"
              onClick={() => void handleAction(confirmAction.userId, confirmAction.action)}
              disabled={actionLoading}
            >
              {actionLoading ? "Processing..." : "Confirm"}
            </button>
          </div>
        </Dialog>
      )}

      {/* User Activity Panel */}
      {activityUserId && (
        <ActivityPanel
          userId={activityUserId}
          onClose={() => setActivityUserId(null)}
        />
      )}
    </div>
  );
}

// --- Sub-components ---

function SortHeader({
  field,
  label,
  current,
  dir,
  toggle,
}: {
  field: SortField;
  label: string;
  current: SortField;
  dir: SortDir;
  toggle: (f: SortField) => void;
}) {
  const active = current === field;
  return (
    <th
      className="px-3 py-3 text-left font-medium cursor-pointer select-none hover:bg-gray-100"
      onClick={() => toggle(field)}
    >
      {label}{" "}
      {active && <span className="text-xs">{dir === "asc" ? "▲" : "▼"}</span>}
    </th>
  );
}

function Dialog({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-bold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ActivityPanel — slide-in panel showing user activity              */
/* ------------------------------------------------------------------ */

function fmtDuration(totalSec: number): string {
  if (totalSec < 60) return `${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function ActionLabel({ action }: { action: string }) {
  const map: Record<string, { label: string; color: string }> = {
    login: { label: "Login", color: "bg-green-100 text-green-700" },
    logout: { label: "Logout", color: "bg-gray-100 text-gray-600" },
    profile_update: { label: "Profile Update", color: "bg-blue-100 text-blue-700" },
    admin_action: { label: "Admin Action", color: "bg-amber-100 text-amber-700" },
    account_deleted: { label: "Account Deleted", color: "bg-red-100 text-red-700" },
    session_expired: { label: "Session Expired", color: "bg-gray-100 text-gray-500" },
  };
  const entry = map[action] ?? { label: action, color: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${entry.color}`}>
      {entry.label}
    </span>
  );
}

function ActivityPanel({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "activity" | "audit">("overview");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/users/${userId}/activity`);
        if (!res.ok) throw new Error("Failed to load activity");
        const json = await res.json() as ActivityData;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [userId]);

  const isAdmin = data?.user.role === "admin";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-2xl mx-0 sm:mx-4 max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold">
              {data
                ? data.user.nickname || data.user.name || data.user.email
                : "User Activity"}
            </h2>
            {data && (
              <p className="text-sm text-gray-500">{data.user.email}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                Admin
              </span>
            )}
            <button
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 shrink-0">
          {(["overview", "activity", ...(isAdmin ? ["audit"] : [])] as const).map((t) => (
            <button
              key={t}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-sky-100 text-sky-700"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
              onClick={() => setTab(t as typeof tab)}
            >
              {t === "overview" ? "📊 Overview" : t === "activity" ? "📋 Activity" : "🔐 Audit Log"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12 text-gray-400">
              Loading...
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">{error}</div>
          )}
          {data && !loading && (
            <>
              {tab === "overview" && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatCard label="Docs Read" value={String(data.readingStats.uniqueDocs)} />
                    <StatCard label="Total Reads" value={String(data.readingStats.totalReads)} />
                    <StatCard
                      label="Time Spent"
                      value={fmtDuration(data.readingStats.totalTimeSec)}
                    />
                    <StatCard
                      label="Last Active"
                      value={
                        data.readingStats.lastReadAt
                          ? new Date(data.readingStats.lastReadAt).toLocaleDateString()
                          : "Never"
                      }
                    />
                  </div>
                  {data.readingStats.firstReadAt && (
                    <p className="text-xs text-gray-400">
                      First read:{" "}
                      {new Date(data.readingStats.firstReadAt).toLocaleString()}
                    </p>
                  )}
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-700">Recent Activity</p>
                    <div className="flex flex-col gap-1">
                      {data.activityLogs.slice(0, 5).map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs"
                        >
                          <ActionLabel action={log.action} />
                          <span className="flex-1 truncate text-gray-500">
                            {log.detail || "—"}
                          </span>
                          <span className="shrink-0 text-gray-400">
                            {new Date(log.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                      {data.activityLogs.length === 0 && (
                        <p className="text-xs text-gray-400">No activity recorded.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === "activity" && (
                <div className="flex flex-col gap-1">
                  {data.activityLogs.map((log) => (
                    <div
                      key={log.id}
                      className="grid grid-cols-[auto_1fr_auto] items-start gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-xs"
                    >
                      <ActionLabel action={log.action} />
                      <span className="min-w-0 break-words text-gray-600">
                        {log.detail || "—"}
                      </span>
                      <div className="shrink-0 text-right text-gray-400">
                        <div>{new Date(log.created_at).toLocaleDateString()}</div>
                        <div>{new Date(log.created_at).toLocaleTimeString()}</div>
                        {log.ip_address && (
                          <div className="text-gray-300">{log.ip_address}</div>
                        )}
                      </div>
                    </div>
                  ))}
                  {data.activityLogs.length === 0 && (
                    <p className="py-4 text-center text-sm text-gray-400">No activity recorded.</p>
                  )}
                </div>
              )}

              {tab === "audit" && isAdmin && (
                <div className="flex flex-col gap-1">
                  {data.auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="grid grid-cols-[auto_1fr_auto] items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs"
                    >
                      <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 whitespace-nowrap">
                        {log.action}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-gray-600">{log.detail || "—"}</div>
                        <div className="text-gray-400">
                          {log.target_type}
                          {log.target_id ? ` · ${log.target_id}` : ""}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-gray-400">
                        <div>{new Date(log.created_at).toLocaleDateString()}</div>
                        <div>{new Date(log.created_at).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  ))}
                  {data.auditLogs.length === 0 && (
                    <p className="py-4 text-center text-sm text-gray-400">No audit entries.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border-2 border-gray-100 bg-white p-3 text-center">
      <span className="text-lg font-bold text-sky-600">{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}
