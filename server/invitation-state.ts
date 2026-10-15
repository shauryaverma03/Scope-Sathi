import type { Project } from "../shared/model";

export function currentInvitationState(
  id: string,
  notificationState: string,
  project: Pick<Project, "invitations"> | undefined,
): string {
  if (notificationState !== "pending") return notificationState;
  return (
    project?.invitations.find((item) => item.id === id)?.state || "revoked"
  );
}

export function canSendInvitation(
  id: string,
  notice: { state: string; expiresAt: string },
  project: Pick<Project, "invitations"> | undefined,
): boolean {
  const item = project?.invitations.find((item) => item.id === id);
  return (
    currentInvitationState(id, notice.state, project) === "pending" &&
    !!item &&
    Number.isFinite(Date.parse(notice.expiresAt)) &&
    Date.parse(notice.expiresAt) > Date.now() &&
    Number.isFinite(Date.parse(item.expiresAt)) &&
    Date.parse(item.expiresAt) > Date.now()
  );
}
