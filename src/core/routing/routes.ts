export const APP_ROUTES = {
  home: "/",
  homeVi: "/vi",
  login: "/login",
  inviteByToken: (token: string) => `/invite/${token}`,
  inviteBoardByToken: (token: string) => `/invite/board/${token}`,
  workspace: {
    index: "/w",
    indexBySlug: (workspaceSlug: string) => `/w?workspace=${encodeURIComponent(workspaceSlug)}`,
    invites: "/w/invites",
    settings: "/w/settings",
    search: "/w/search",
    bySlug: (workspaceSlug: string) => `/w/${workspaceSlug}`,
    invitesBySlug: (workspaceSlug: string) => `/w/invites?workspace=${encodeURIComponent(workspaceSlug)}`,
    settingsBySlug: (workspaceSlug: string, tab?: "danger" | "general" | "members") => {
      const params = new URLSearchParams({
        workspace: workspaceSlug,
      });
      if (tab) {
        params.set("tab", tab);
      }
      return `/w/settings?${params.toString()}`;
    },
    membersBySlug: (workspaceSlug: string) => {
      const params = new URLSearchParams({
        tab: "members",
        workspace: workspaceSlug,
      });
      return `/w/settings?${params.toString()}`;
    },
    billingBySlug: (workspaceSlug: string) => {
      const params = new URLSearchParams({
        tab: "billing",
        workspace: workspaceSlug,
      });
      return `/w/settings?${params.toString()}`;
    },
    boardsBySlug: (workspaceSlug: string) => `/w?workspace=${encodeURIComponent(workspaceSlug)}`,
    boardById: (workspaceSlug: string, boardId: string) =>
      `/w/${workspaceSlug}/board/${boardId}`,
  },
} as const;
