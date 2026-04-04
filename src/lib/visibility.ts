import type { VisibilityType } from "@/types";

export interface ViewerContext {
  role: "admin" | "user";
  groupIds: string[];
}

export interface DocumentVisibilityInfo {
  accessOverride: boolean;
  visibility: VisibilityType;
  userGroupIds: string[];
  groupVisibility: VisibilityType | null;
  groupUserGroupIds: string[];
}

/**
 * Determine whether a viewer can see a document.
 *
 * - admin: always true
 * - public: always true (including unauthenticated guests)
 * - admin_only: false for non-admins
 * - user_groups: true only for authenticated users whose groupIds overlap
 */
export function canViewerSeeDocument(
  viewer: ViewerContext | null,
  doc: DocumentVisibilityInfo
): boolean {
  const effectiveVisibility = doc.accessOverride
    ? doc.visibility
    : (doc.groupVisibility ?? "admin_only");
  const effectiveGroupIds = doc.accessOverride
    ? doc.userGroupIds
    : doc.groupUserGroupIds;

  if (viewer?.role === "admin") return true;
  if (effectiveVisibility === "public") return true;
  if (!viewer) return false;
  if (effectiveVisibility === "admin_only") return false;
  if (effectiveVisibility === "user_groups") {
    return viewer.groupIds.some((id) => effectiveGroupIds.includes(id));
  }
  return false;
}

/**
 * Determine whether a viewer can see a document group (bookshelf).
 * A group is visible if:
 * - The group's own visibility allows viewer, OR
 * - Any document inside is visible to viewer (handled at query layer)
 */
export function canViewerSeeGroup(
  viewer: ViewerContext | null,
  group: { visibility: VisibilityType; userGroupIds: string[] }
): boolean {
  if (viewer?.role === "admin") return true;
  if (group.visibility === "public") return true;
  if (!viewer) return false;
  if (group.visibility === "admin_only") return false;
  if (group.visibility === "user_groups") {
    return viewer.groupIds.some((id) => group.userGroupIds.includes(id));
  }
  return false;
}
