import { notFound } from "next/navigation";
import { getReadOnlyAuthContext } from "@/lib/auth";
import {
  getDocumentById,
  getDocumentUserGroupIds,
} from "@/lib/repositories/document-repository";
import { listDocumentGroupsWithVisibility } from "@/lib/repositories/document-group-repository";
import { getUserGroupIds } from "@/lib/repositories/user-group-repository";
import { canViewerSeeDocument } from "@/lib/visibility";
import ReadPageClient from "./ReadPageClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReadPage({ params }: PageProps) {
  const { id } = await params;
  const document = getDocumentById(id);

  if (!document) {
    notFound();
  }

  const { user } = await getReadOnlyAuthContext();

  if (user?.role !== "admin") {
    const viewer = user
      ? { role: user.role, groupIds: getUserGroupIds(user.id) }
      : null;
    const groups = listDocumentGroupsWithVisibility();
    const group = document.groupId
      ? groups.find((candidate) => candidate.id === document.groupId)
      : null;
    const canRead = canViewerSeeDocument(viewer, {
      accessOverride: Boolean(document.accessOverride),
      visibility: document.visibility ?? "admin_only",
      userGroupIds: getDocumentUserGroupIds(document.id),
      groupVisibility: group?.visibility ?? null,
      groupUserGroupIds: group?.userGroupIds ?? [],
    });

    if (!canRead) {
      notFound();
    }
  }

  return <ReadPageClient documentId={id} initialDocument={document} />;
}
