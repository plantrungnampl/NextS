export const APP_ROUTES = {
  home: "/",
  login: "/login",
  authConfirm: "/auth/confirm",
  authSignout: "/auth/signout",
  inviteByToken: (token: string) => `/invite/${token}`,
  inviteBoardByToken: (token: string) => `/invite/board/${token}`,
  workspace: {
    index: "/w",
    indexBySlug: (workspaceSlug: string) => `/w?workspace=${encodeURIComponent(workspaceSlug)}`,
    invites: "/w/invites",
    search: "/w/search",
    bySlug: (workspaceSlug: string) => `/w/${workspaceSlug}`,
    invitesBySlug: (workspaceSlug: string) => `/w/invites?workspace=${encodeURIComponent(workspaceSlug)}`,
    boardsBySlug: (workspaceSlug: string) => `/w?workspace=${encodeURIComponent(workspaceSlug)}`,
    boardById: (workspaceSlug: string, boardId: string) =>
      `/w/${workspaceSlug}/board/${boardId}`,
  },
} as const;
