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
              <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50/50">
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
                <td className="px-3 py-3">
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
