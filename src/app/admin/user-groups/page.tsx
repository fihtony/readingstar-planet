"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useCsrfFetch } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import type { UserGroup } from "@/types";

type GroupMember = {
  id: string;
  email: string;
  name: string;
  nickname: string;
  role: string;
  status: string;
  assignedAt: string;
};

type CandidateUser = {
  id: string;
  email: string;
  name: string;
  nickname: string;
  role: string;
  status: string;
  userGroupIds: string[];
};

export default function AdminUserGroupsPage() {
  const router = useRouter();
  const { isAdmin, isLoading } = useAuth();
  const csrfFetch = useCsrfFetch();

  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Selected group for member management
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberRoleFilter, setMemberRoleFilter] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState("");
  const [memberGroupFilter, setMemberGroupFilter] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [removingMembers, setRemovingMembers] = useState(false);

  // Add members
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [candidates, setCandidates] = useState<CandidateUser[]>([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateRoleFilter, setCandidateRoleFilter] = useState("");
  const [candidateStatusFilter, setCandidateStatusFilter] = useState("");
  const [candidateGroupFilter, setCandidateGroupFilter] = useState("");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [addLoading, setAddLoading] = useState(false);

  // Remove member confirmation
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<GroupMember | null>(null);

  // Delete confirmation
  const [deletingGroup, setDeletingGroup] = useState<UserGroup | null>(null);
  const [deleteForce, setDeleteForce] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Edit group
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/user-groups");
      if (!res.ok) throw new Error("Failed to load user groups");
      const data = await res.json();
      setGroups(data.groups ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (!isAdmin) {
        router.replace("/");
        return;
      }
      fetchGroups();
    }
  }, [isAdmin, isLoading, router, fetchGroups]);

  const fetchMembers = useCallback(async (groupId: string) => {
    setMembersLoading(true);
    try {
      const params = new URLSearchParams();
      if (memberSearch) params.set("query", memberSearch);
      if (memberRoleFilter) params.set("role", memberRoleFilter);
      if (memberStatusFilter) params.set("status", memberStatusFilter);
      if (memberGroupFilter) params.set("groupId", memberGroupFilter);
      const res = await fetch(
        `/api/admin/user-groups/${groupId}/members?${params.toString()}`
      );
      if (!res.ok) throw new Error("Failed to load members");
      const data = await res.json();
      setMembers(data.members ?? []);
      setSelectedMemberIds((prev) => new Set([...prev].filter((id) => (data.members ?? []).some((member: GroupMember) => member.id === id))));
    } catch {
      setMembers([]);
      setSelectedMemberIds(new Set());
    } finally {
      setMembersLoading(false);
    }
  }, [memberGroupFilter, memberRoleFilter, memberSearch, memberStatusFilter]);

  const fetchCandidates = useCallback(async (groupId: string) => {
    try {
      const params = new URLSearchParams();
      if (candidateSearch) params.set("query", candidateSearch);
      if (candidateRoleFilter) params.set("role", candidateRoleFilter);
      if (candidateStatusFilter) params.set("status", candidateStatusFilter);
      if (candidateGroupFilter) params.set("groupId", candidateGroupFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const memberIds = new Set(members.map((m) => m.id));
      setCandidates(
        (data.users ?? []).filter(
          (u: CandidateUser) =>
            !memberIds.has(u.id) &&
            u.status !== "deleted"
        )
      );
    } catch {
      setCandidates([]);
    }
  }, [candidateGroupFilter, candidateRoleFilter, candidateSearch, candidateStatusFilter, members]);

  useEffect(() => {
    if (selectedGroup) {
      fetchMembers(selectedGroup.id);
    }
  }, [selectedGroup, memberSearch, memberRoleFilter, memberStatusFilter, memberGroupFilter, fetchMembers]);

  useEffect(() => {
    if (showAddMembers && selectedGroup) {
      fetchCandidates(selectedGroup.id);
    }
  }, [showAddMembers, selectedGroup, candidateSearch, candidateRoleFilter, candidateStatusFilter, candidateGroupFilter, fetchCandidates]);

  const handleCreateGroup = async () => {
    if (!newName.trim()) return;
    setCreateLoading(true);
    setCreateError(null);
    try {
      const res = await csrfFetch("/api/admin/user-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCreateError(data.error || "Failed to create group");
        return;
      }
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      await fetchGroups();
    } catch {
      setCreateError("Failed to create group");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditGroup = async () => {
    if (!editingGroup) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await csrfFetch(`/api/admin/user-groups/${editingGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error || "Failed to update group");
        return;
      }
      setEditingGroup(null);
      await fetchGroups();
      if (selectedGroup?.id === editingGroup.id) {
        const data = await res.json().catch(() => ({}));
        if (data.group) setSelectedGroup(data.group);
      }
    } catch {
      setEditError("Failed to update group");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deletingGroup) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const params = deleteForce ? "?force=true" : "";
      const res = await csrfFetch(`/api/admin/user-groups/${deletingGroup.id}${params}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) {
          setDeleteError(
            `This group has ${data.memberCount} member(s). Check "Confirm removal of all members" to proceed.`
          );
          return;
        }
        setDeleteError(data.error || "Failed to delete group");
        return;
      }
      setDeletingGroup(null);
      setDeleteForce(false);
      if (selectedGroup?.id === deletingGroup.id) {
        setSelectedGroup(null);
        setMembers([]);
      }
      await fetchGroups();
    } catch {
      setDeleteError("Failed to delete group");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedGroup) return;
    try {
      const res = await csrfFetch(
        `/api/admin/user-groups/${selectedGroup.id}/members/${userId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setConfirmRemoveMember(null);
        await fetchMembers(selectedGroup.id);
        await fetchGroups();
      }
    } catch {
      // silent
    }
  };

  const handleRemoveSelectedMembers = async () => {
    if (!selectedGroup || selectedMemberIds.size === 0) return;

    setRemovingMembers(true);
    try {
      await Promise.all(
        Array.from(selectedMemberIds).map((userId) =>
          csrfFetch(`/api/admin/user-groups/${selectedGroup.id}/members/${userId}`, {
            method: "DELETE",
          })
        )
      );
      setSelectedMemberIds(new Set());
      await fetchMembers(selectedGroup.id);
      await fetchGroups();
    } finally {
      setRemovingMembers(false);
    }
  };

  const handleAddMembers = async () => {
    if (!selectedGroup || selectedCandidateIds.size === 0) return;
    setAddLoading(true);
    try {
      const res = await csrfFetch(
        `/api/admin/user-groups/${selectedGroup.id}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds: Array.from(selectedCandidateIds) }),
        }
      );
      if (res.ok) {
        setShowAddMembers(false);
        setSelectedCandidateIds(new Set());
        setCandidateSearch("");
        await fetchMembers(selectedGroup.id);
        await fetchGroups();
      }
    } catch {
      // silent
    } finally {
      setAddLoading(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-orange-500">👥 User Groups</h1>
          <p className="text-sm text-gray-500">
            Manage groups to control which users can access specific bookshelves and books.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New Group</Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
          <h2 className="mb-3 font-semibold text-sky-700">New User Group</h2>
          {createError && (
            <div className="mb-2 text-sm text-red-600">{createError}</div>
          )}
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Group name (required, max 50 chars)"
              maxLength={50}
              className="rounded-lg border border-sky-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Description (optional, max 200 chars)"
              maxLength={200}
              className="rounded-lg border border-sky-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleCreateGroup}
                disabled={!newName.trim() || createLoading}
              >
                {createLoading ? "Creating..." : "Create"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreate(false);
                  setCreateError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* Group list */}
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase text-gray-400">
            Groups ({groups.length})
          </div>
          {groups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
              No groups yet. Create one to get started.
            </div>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                  selectedGroup?.id === group.id
                    ? "border-sky-300 bg-sky-50"
                    : "border-gray-100 bg-white hover:bg-gray-50"
                }`}
                onClick={() => {
                  setSelectedGroup(group);
                  setMemberSearch("");
                  setMemberRoleFilter("");
                  setMemberStatusFilter("");
                  setMemberGroupFilter("");
                  setSelectedMemberIds(new Set());
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-gray-800">{group.name}</div>
                    {group.description && (
                      <div className="mt-0.5 truncate text-xs text-gray-400">
                        {group.description}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-gray-400">
                      {group.memberCount ?? 0} member
                      {(group.memberCount ?? 0) !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      className="rounded px-2 py-0.5 text-xs text-sky-500 hover:bg-sky-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingGroup(group);
                        setEditName(group.name);
                        setEditDescription(group.description);
                        setEditError(null);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded px-2 py-0.5 text-xs text-red-400 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingGroup(group);
                        setDeleteForce(false);
                        setDeleteError(null);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Member management panel */}
        {selectedGroup ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">
                👥 {selectedGroup.name}
                <span className="ml-2 text-sm font-normal text-gray-400">
                  — Members
                </span>
              </h2>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAddMembers(true);
                  setCandidateSearch("");
                  setCandidateRoleFilter("");
                  setCandidateStatusFilter("");
                  setCandidateGroupFilter("");
                  setSelectedCandidateIds(new Set());
                }}
              >
                + Add Members
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Search by name/email..."
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
              <select
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                value={memberRoleFilter}
                onChange={(e) => setMemberRoleFilter(e.target.value)}
              >
                <option value="">All roles</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
              <select
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                value={memberStatusFilter}
                onChange={(e) => setMemberStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending_verification">Pending</option>
              </select>
              <select
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                value={memberGroupFilter}
                onChange={(e) => setMemberGroupFilter(e.target.value)}
              >
                <option value="">All user groups</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                onClick={handleRemoveSelectedMembers}
                disabled={selectedMemberIds.size === 0 || removingMembers}
              >
                {removingMembers ? "Removing..." : `Remove Selected (${selectedMemberIds.size})`}
              </Button>
            </div>

            {membersLoading ? (
              <div className="text-sm text-gray-400">Loading members...</div>
            ) : members.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                No members found. Use &quot;Add Members&quot; to add users.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left">
                        <input
                          type="checkbox"
                          aria-label="Select all members"
                          checked={members.length > 0 && members.every((member) => selectedMemberIds.has(member.id))}
                          onChange={(e) => {
                            setSelectedMemberIds(
                              e.target.checked
                                ? new Set(members.map((member) => member.id))
                                : new Set()
                            );
                          }}
                        />
                      </th>
                      <th className="px-4 py-2 text-left">User</th>
                      <th className="px-4 py-2 text-left">Role</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-2 align-top">
                          <input
                            type="checkbox"
                            aria-label={`Select ${member.email}`}
                            checked={selectedMemberIds.has(member.id)}
                            onChange={(e) => {
                              setSelectedMemberIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) {
                                  next.add(member.id);
                                } else {
                                  next.delete(member.id);
                                }
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-800">
                            {member.nickname || member.name || member.email}
                          </div>
                          <div className="text-xs text-gray-400">{member.email}</div>
                        </td>
                        <td className="px-4 py-2 text-gray-500">{member.role}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                              member.status === "active"
                                ? "bg-green-100 text-green-700"
                                : member.status === "inactive"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {member.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            className="rounded px-2 py-0.5 text-xs text-red-400 hover:bg-red-50"
                            onClick={() => setConfirmRemoveMember(member)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 p-10 text-sm text-gray-400">
            Select a group to manage its members.
          </div>
        )}
      </div>

      {/* Edit group modal */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-bold">Edit User Group</h2>
            {editError && (
              <div className="mb-2 text-sm text-red-600">{editError}</div>
            )}
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Group name"
                maxLength={50}
                className="rounded-lg border px-3 py-2 text-sm"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <input
                type="text"
                placeholder="Description"
                maxLength={200}
                className="rounded-lg border px-3 py-2 text-sm"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                onClick={handleEditGroup}
                disabled={!editName.trim() || editLoading}
              >
                {editLoading ? "Saving..." : "Save"}
              </Button>
              <Button variant="ghost" onClick={() => setEditingGroup(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-red-600">Delete User Group</h2>
            <p className="mb-3 text-sm text-gray-600">
              Delete &quot;{deletingGroup.name}&quot;? This action cannot be undone.
            </p>
            {deleteError && (
              <div className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">
                {deleteError}
              </div>
            )}
            {(deletingGroup.memberCount ?? 0) > 0 && (
              <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={deleteForce}
                  onChange={(e) => setDeleteForce(e.target.checked)}
                  className="rounded"
                />
                I understand — remove all {deletingGroup.memberCount} member(s) and delete this group
              </label>
            )}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleDeleteGroup}
                disabled={
                  deleteLoading ||
                  ((deletingGroup.memberCount ?? 0) > 0 && !deleteForce)
                }
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setDeletingGroup(null);
                  setDeleteError(null);
                  setDeleteForce(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Remove member confirmation modal */}
      {confirmRemoveMember && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-red-600">Remove Member</h2>
            <p className="mb-4 text-sm text-gray-600">
              Remove{" "}
              <span className="font-medium">
                {confirmRemoveMember.nickname || confirmRemoveMember.name || confirmRemoveMember.email}
              </span>{" "}
              from &quot;{selectedGroup.name}&quot;?
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => handleRemoveMember(confirmRemoveMember.id)}
              >
                Remove
              </Button>
              <Button variant="ghost" onClick={() => setConfirmRemoveMember(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add members modal */}
      {showAddMembers && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-3 text-lg font-bold">
              Add Members to &quot;{selectedGroup.name}&quot;
            </h2>
            <input
              type="text"
              placeholder="Search users..."
              className="mb-3 w-full rounded-lg border px-3 py-2 text-sm"
              value={candidateSearch}
              onChange={(e) => setCandidateSearch(e.target.value)}
            />
            <div className="mb-3 grid gap-2 sm:grid-cols-3">
              <select
                className="rounded-lg border px-3 py-2 text-sm"
                value={candidateRoleFilter}
                onChange={(e) => setCandidateRoleFilter(e.target.value)}
              >
                <option value="">All roles</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
              <select
                className="rounded-lg border px-3 py-2 text-sm"
                value={candidateStatusFilter}
                onChange={(e) => setCandidateStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending_verification">Pending</option>
              </select>
              <select
                className="rounded-lg border px-3 py-2 text-sm"
                value={candidateGroupFilter}
                onChange={(e) => setCandidateGroupFilter(e.target.value)}
              >
                <option value="">All user groups</option>
                {groups
                  .filter((group) => group.id !== selectedGroup.id)
                  .map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-100">
              {candidates.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-400">
                  No eligible users to add.
                </div>
              ) : (
                candidates.map((c) => {
                  const isAdminUser = c.role === "admin";
                  const userGroupNames = c.userGroupIds
                    .map((gid) => groups.find((g) => g.id === gid)?.name)
                    .filter(Boolean) as string[];
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 border-b border-gray-50 px-4 py-2 ${
                        isAdminUser
                          ? "cursor-not-allowed bg-gray-50 opacity-60"
                          : "cursor-pointer hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={isAdminUser}
                        checked={selectedCandidateIds.has(c.id)}
                        onChange={(e) => {
                          if (isAdminUser) return;
                          setSelectedCandidateIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) {
                              next.add(c.id);
                            } else {
                              next.delete(c.id);
                            }
                            return next;
                          });
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span className="shrink-0 font-medium text-gray-800 text-sm">
                            {c.nickname || c.name || c.email}
                          </span>
                          {isAdminUser && (
                            <span className="shrink-0 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                              Admin
                            </span>
                          )}
                          {userGroupNames.slice(0, 2).map((gname) => (
                            <span
                              key={gname}
                              className="shrink-0 inline-block rounded-full bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600"
                            >
                              {gname}
                            </span>
                          ))}
                          {userGroupNames.length > 2 && (
                            <span className="shrink-0 text-xs text-gray-400">
                              +{userGroupNames.length - 2}…
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-gray-400">{c.email}</div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-gray-400">
                {selectedCandidateIds.size} selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={handleAddMembers}
                  disabled={selectedCandidateIds.size === 0 || addLoading}
                >
                  {addLoading ? "Adding..." : "Add Selected"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowAddMembers(false);
                    setCandidateRoleFilter("");
                    setCandidateStatusFilter("");
                    setCandidateGroupFilter("");
                    setSelectedCandidateIds(new Set());
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
