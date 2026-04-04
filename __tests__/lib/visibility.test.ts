import { describe, it, expect } from "vitest";
import {
  canViewerSeeDocument,
  canViewerSeeGroup,
  type ViewerContext,
  type DocumentVisibilityInfo,
} from "@/lib/visibility";

// ── Helpers ────────────────────────────────────────────────────────────────

function publicDoc(overrides?: Partial<DocumentVisibilityInfo>): DocumentVisibilityInfo {
  return {
    accessOverride: false,
    visibility: "public",
    userGroupIds: [],
    groupVisibility: "public",
    groupUserGroupIds: [],
    ...overrides,
  };
}

function adminOnlyDoc(overrides?: Partial<DocumentVisibilityInfo>): DocumentVisibilityInfo {
  return {
    accessOverride: false,
    visibility: "admin_only",
    userGroupIds: [],
    groupVisibility: "admin_only",
    groupUserGroupIds: [],
    ...overrides,
  };
}

function userGroupsDoc(
  groupIds: string[],
  overrides?: Partial<DocumentVisibilityInfo>
): DocumentVisibilityInfo {
  return {
    accessOverride: false,
    visibility: "user_groups",
    userGroupIds: groupIds,
    groupVisibility: "user_groups",
    groupUserGroupIds: groupIds,
    ...overrides,
  };
}

const adminViewer: ViewerContext = { role: "admin", groupIds: [] };
const userViewer: ViewerContext = { role: "user", groupIds: ["g-readers"] };
const guestViewer: ViewerContext | null = null;

// ── canViewerSeeDocument ────────────────────────────────────────────────────

describe("canViewerSeeDocument", () => {
  describe("public document (inherits group)", () => {
    it("admin can see public document", () => {
      expect(canViewerSeeDocument(adminViewer, publicDoc())).toBe(true);
    });

    it("authenticated user can see public document", () => {
      expect(canViewerSeeDocument(userViewer, publicDoc())).toBe(true);
    });

    it("guest can see public document", () => {
      expect(canViewerSeeDocument(guestViewer, publicDoc())).toBe(true);
    });
  });

  describe("admin_only document (inherits group)", () => {
    it("admin can see admin_only document", () => {
      expect(canViewerSeeDocument(adminViewer, adminOnlyDoc())).toBe(true);
    });

    it("authenticated user cannot see admin_only document", () => {
      expect(canViewerSeeDocument(userViewer, adminOnlyDoc())).toBe(false);
    });

    it("guest cannot see admin_only document", () => {
      expect(canViewerSeeDocument(guestViewer, adminOnlyDoc())).toBe(false);
    });
  });

  describe("user_groups document (inherits group)", () => {
    const groupDoc = userGroupsDoc(["g-readers"]);

    it("admin can see user_groups document", () => {
      expect(canViewerSeeDocument(adminViewer, groupDoc)).toBe(true);
    });

    it("user in matching group can see document", () => {
      const viewer: ViewerContext = { role: "user", groupIds: ["g-readers"] };
      expect(canViewerSeeDocument(viewer, groupDoc)).toBe(true);
    });

    it("user NOT in matching group cannot see document", () => {
      const viewer: ViewerContext = { role: "user", groupIds: ["g-other"] };
      expect(canViewerSeeDocument(viewer, groupDoc)).toBe(false);
    });

    it("user with no groups cannot see user_groups document", () => {
      const viewer: ViewerContext = { role: "user", groupIds: [] };
      expect(canViewerSeeDocument(viewer, groupDoc)).toBe(false);
    });

    it("guest cannot see user_groups document", () => {
      expect(canViewerSeeDocument(guestViewer, groupDoc)).toBe(false);
    });
  });

  describe("document with accessOverride=true uses its own visibility", () => {
    it("overridden public doc visible to guest even in admin_only group", () => {
      const doc: DocumentVisibilityInfo = {
        accessOverride: true,
        visibility: "public",
        userGroupIds: [],
        groupVisibility: "admin_only",
        groupUserGroupIds: [],
      };
      expect(canViewerSeeDocument(guestViewer, doc)).toBe(true);
    });

    it("overridden admin_only doc hides from user even in public group", () => {
      const doc: DocumentVisibilityInfo = {
        accessOverride: true,
        visibility: "admin_only",
        userGroupIds: [],
        groupVisibility: "public",
        groupUserGroupIds: [],
      };
      expect(canViewerSeeDocument(userViewer, doc)).toBe(false);
    });

    it("overridden user_groups doc uses its own group list, not group's group list", () => {
      const doc: DocumentVisibilityInfo = {
        accessOverride: true,
        visibility: "user_groups",
        userGroupIds: ["g-special"],
        groupVisibility: "user_groups",
        groupUserGroupIds: ["g-other"],
      };
      const specialViewer: ViewerContext = { role: "user", groupIds: ["g-special"] };
      const otherViewer: ViewerContext = { role: "user", groupIds: ["g-other"] };

      expect(canViewerSeeDocument(specialViewer, doc)).toBe(true);
      expect(canViewerSeeDocument(otherViewer, doc)).toBe(false);
    });
  });

  describe("document without accessOverride inherits group visibility", () => {
    it("falls back to group visibility when accessOverride=false", () => {
      // doc visibility is public but group is admin_only — group wins
      const doc: DocumentVisibilityInfo = {
        accessOverride: false,
        visibility: "public",
        userGroupIds: [],
        groupVisibility: "admin_only",
        groupUserGroupIds: [],
      };
      expect(canViewerSeeDocument(userViewer, doc)).toBe(false);
    });

    it("null groupVisibility treated as admin_only", () => {
      const doc: DocumentVisibilityInfo = {
        accessOverride: false,
        visibility: "public",
        userGroupIds: [],
        groupVisibility: null,
        groupUserGroupIds: [],
      };
      expect(canViewerSeeDocument(userViewer, doc)).toBe(false);
      expect(canViewerSeeDocument(adminViewer, doc)).toBe(true);
    });
  });

  describe("user_groups with multiple groups", () => {
    it("user matching any one group in list can see document", () => {
      const doc = userGroupsDoc(["g-a", "g-b", "g-c"]);
      const viewer: ViewerContext = { role: "user", groupIds: ["g-b"] };
      expect(canViewerSeeDocument(viewer, doc)).toBe(true);
    });

    it("user with multiple groups matched against single group", () => {
      const doc = userGroupsDoc(["g-a"]);
      const viewer: ViewerContext = { role: "user", groupIds: ["g-a", "g-b"] };
      expect(canViewerSeeDocument(viewer, doc)).toBe(true);
    });
  });
});

// ── canViewerSeeGroup ───────────────────────────────────────────────────────

describe("canViewerSeeGroup", () => {
  it("admin can see any group visibility", () => {
    expect(canViewerSeeGroup(adminViewer, { visibility: "public", userGroupIds: [] })).toBe(true);
    expect(canViewerSeeGroup(adminViewer, { visibility: "admin_only", userGroupIds: [] })).toBe(true);
    expect(canViewerSeeGroup(adminViewer, { visibility: "user_groups", userGroupIds: ["g-x"] })).toBe(true);
  });

  it("guest can only see public groups", () => {
    expect(canViewerSeeGroup(guestViewer, { visibility: "public", userGroupIds: [] })).toBe(true);
    expect(canViewerSeeGroup(guestViewer, { visibility: "admin_only", userGroupIds: [] })).toBe(false);
    expect(canViewerSeeGroup(guestViewer, { visibility: "user_groups", userGroupIds: ["g-x"] })).toBe(false);
  });

  it("user can see public and matching user_groups", () => {
    const viewer: ViewerContext = { role: "user", groupIds: ["g-readers"] };
    expect(canViewerSeeGroup(viewer, { visibility: "public", userGroupIds: [] })).toBe(true);
    expect(canViewerSeeGroup(viewer, { visibility: "admin_only", userGroupIds: [] })).toBe(false);
    expect(canViewerSeeGroup(viewer, { visibility: "user_groups", userGroupIds: ["g-readers"] })).toBe(true);
    expect(canViewerSeeGroup(viewer, { visibility: "user_groups", userGroupIds: ["g-other"] })).toBe(false);
  });
});
