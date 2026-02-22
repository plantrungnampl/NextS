export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type BoardMemberRole = "viewer" | "member" | "admin";
export type BoardVisibility = "workspace" | "private" | "public";
export type BoardPermissionLevel = "admins" | "members";

export type BoardSettings = {
  commentPermission: BoardPermissionLevel;
  editPermission: BoardPermissionLevel;
  memberManagePermission: BoardPermissionLevel;
  showCardCoverOnFront: boolean;
  showCompleteStatusOnFront: boolean;
};

export type BoardViewer = {
  displayName: string;
  email: string;
  id: string;
};

export type WorkspaceRecord = {
  id: string;
  name: string;
  slug: string;
};

export type BoardRecord = {
  description: string | null;
  editPermission: BoardPermissionLevel;
  id: string;
  isFavorite: boolean;
  commentPermission: BoardPermissionLevel;
  memberManagePermission: BoardPermissionLevel;
  name: string;
  showCardCoverOnFront: boolean;
  showCompleteStatusOnFront: boolean;
  syncVersion: number;
  visibility: BoardVisibility;
};

export type LabelRecord = {
  color: string;
  id: string;
  name: string;
};

export type WorkspaceMemberRecord = {
  avatarUrl: string | null;
  displayName: string;
  id: string;
  role: WorkspaceRole;
};

export type CommentRecord = {
  authorAvatarUrl: string | null;
  authorDisplayName: string;
  body: string;
  createdAt: string;
  createdBy: string;
  id: string;
  updatedAt: string;
};

export type AttachmentRecord = {
  contentType: string | null;
  createdAt: string;
  createdByAvatarUrl: string | null;
  createdByDisplayName: string;
  createdBy: string;
  externalUrl: string | null;
  fileName: string;
  id: string;
  sizeBytes: number;
  sourceType: "file" | "url";
  storagePath: string | null;
};

export type ChecklistItemRecord = {
  body: string;
  checklistId: string;
  id: string;
  isDone: boolean;
  position: number;
};

export type ChecklistRecord = {
  cardId: string;
  id: string;
  items: ChecklistItemRecord[];
  position: number;
  title: string;
};

export type ListRecord = {
  id: string;
  position: number;
  title: string;
};

export type CardRecord = {
  attachmentCount?: number;
  assignees: WorkspaceMemberRecord[];
  attachments: AttachmentRecord[];
  checklistCompletedCount?: number;
  checklistTotalCount?: number;
  commentCount?: number;
  completed_at: string | null;
  coverAttachmentId?: string | null;
  comments: CommentRecord[];
  description: string | null;
  due_at: string | null;
  effort: string | null;
  has_due_time: boolean;
  has_start_time: boolean;
  id: string;
  is_completed: boolean;
  labels: LabelRecord[];
  list_id: string;
  position: number;
  priority: string | null;
  recurrence_anchor_at: string | null;
  recurrence_rrule: string | null;
  recurrence_tz: string | null;
  reminder_offset_minutes: number | null;
  start_at: string | null;
  status: string | null;
  title: string;
  watchCount?: number;
  watchedByViewer?: boolean;
};

export type CardRichnessSnapshot = Pick<
  CardRecord,
  "assignees" | "attachments" | "comments" | "labels"
> & {
  checklists: ChecklistRecord[];
};

export type ListWithCards = ListRecord & {
  cards: CardRecord[];
};

export type BoardPageData = {
  board: BoardRecord;
  canWriteBoard: boolean;
  listsWithCards: ListWithCards[];
  membershipRole: WorkspaceRole;
  privateInboxCards: CardRecord[];
  viewer: BoardViewer;
  workspaceLabels: LabelRecord[];
  workspaceMembers: WorkspaceMemberRecord[];
  workspace: WorkspaceRecord;
};
