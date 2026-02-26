import Link from "next/link";
import type { ReactNode } from "react";
import { Shield, Users, Zap } from "lucide-react";

import { Badge } from "@/components/ui";
import { APP_ROUTES } from "@/core";
import { cn } from "@/shared";

import type { WorkspaceSettingsTab } from "../page.data";

type WorkspaceHeaderWorkspace = {
  id: string;
  name: string;
  slug: string;
};

type WorkspaceSettingsHeaderProps = {
  activeTab: WorkspaceSettingsTab;
  selectedRole: "admin" | "member" | "owner";
  selectedWorkspace: WorkspaceHeaderWorkspace;
  workspaces: WorkspaceHeaderWorkspace[];
};

function TabLink({
  active,
  href,
  icon,
  label,
}: {
  active: boolean;
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors",
        active
          ? "border-sky-400/70 bg-sky-500/20 text-sky-100"
          : "border-slate-700 bg-[#101520] text-slate-300 hover:border-slate-500 hover:text-white",
      )}
      href={href}
    >
      <span className="text-current">{icon}</span>
      {label}
    </Link>
  );
}

export function WorkspaceSettingsHeader({
  activeTab,
  selectedRole,
  selectedWorkspace,
  workspaces,
}: WorkspaceSettingsHeaderProps) {
  const workspaceSelectorTab = activeTab === "billing" ? "general" : activeTab;
  const generalHref = APP_ROUTES.workspace.settingsBySlug(selectedWorkspace.slug, "general");
  const membersHref = APP_ROUTES.workspace.settingsBySlug(selectedWorkspace.slug, "members");
  const dangerHref = APP_ROUTES.workspace.settingsBySlug(selectedWorkspace.slug, "danger");

  return (
    <header className="border-b border-slate-800/80 px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-sky-300/80">Workspace Settings</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-100">{selectedWorkspace.name}</h1>
          <p className="text-sm text-slate-400">Quản trị cấu hình, thành viên và vùng thao tác nhạy cảm.</p>
        </div>
        <Badge className="border border-slate-700 bg-[#0d1523] text-slate-200" variant="outline">
          Role: {selectedRole}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {workspaces.map((workspace) => {
          const isActive = workspace.slug === selectedWorkspace.slug;
          return (
            <Link
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-sky-600/25 text-sky-100"
                  : "bg-[#121826] text-slate-300 hover:bg-slate-800 hover:text-white",
              )}
              href={APP_ROUTES.workspace.settingsBySlug(workspace.slug, workspaceSelectorTab)}
              key={workspace.id}
            >
              {workspace.name}
            </Link>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <TabLink active={activeTab === "general"} href={generalHref} icon={<Zap className="h-3.5 w-3.5" />} label="General" />
        <TabLink active={activeTab === "members"} href={membersHref} icon={<Users className="h-3.5 w-3.5" />} label="Members" />
        <TabLink active={activeTab === "danger"} href={dangerHref} icon={<Shield className="h-3.5 w-3.5" />} label="Danger" />
      </div>
    </header>
  );
}
