import Link from "next/link";
import {
  CreditCard,
  LayoutGrid,
  Home,
  Settings,
  Users,
  Shapes,
  type LucideIcon,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Input,
  Label,
  SubmitButton,
} from "@/components/ui";
import { APP_ROUTES } from "@/core";
import { cn } from "@/shared";

import { createWorkspace } from "../actions";

type SidebarIconName = "billing" | "boards" | "home" | "members" | "settings" | "templates";

type WorkspaceSidebarWorkspace = {
  id: string;
  name: string;
  slug: string;
};

type WorkspaceSidebarProps = {
  activeWorkspaceSlug?: string;
  messageType?: string;
  statusMessage: string | undefined;
  workspaces: WorkspaceSidebarWorkspace[];
};

function SidebarIcon({ name }: { name: SidebarIconName }) {
  const iconByName: Record<SidebarIconName, LucideIcon> = {
    billing: CreditCard,
    boards: LayoutGrid,
    home: Home,
    members: Users,
    settings: Settings,
    templates: Shapes,
  };
  const Icon = iconByName[name];
  return <Icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />;
}

function SidebarNavLink({
  active = false,
  href,
  icon,
  label,
}: {
  active?: boolean;
  href: string;
  icon: SidebarIconName;
  label: string;
}) {
  return (
    <Link
      className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sky-600/20 text-sky-200"
          : "text-slate-300 hover:bg-slate-800/70 hover:text-white",
      )}
      href={href}
    >
      <span className={active ? "text-sky-200" : "text-slate-400"}>
        <SidebarIcon name={icon} />
      </span>
      <span>{label}</span>
    </Link>
  );
}

function WorkspaceMenu({ expandedWorkspaceSlug, workspaces }: {
  expandedWorkspaceSlug: string | undefined;
  workspaces: WorkspaceSidebarWorkspace[];
}) {
  if (workspaces.length === 0) {
    return <p className="px-2 text-sm text-slate-500">Chưa có không gian làm việc.</p>;
  }

  return (
    <Accordion className="space-y-2" collapsible defaultValue={expandedWorkspaceSlug} type="single">
      {workspaces.map((workspace) => {
        const workspaceMembersHref = APP_ROUTES.workspace.membersBySlug(workspace.slug);
        const workspaceSettingsHref = APP_ROUTES.workspace.settingsBySlug(workspace.slug);
        return (
          <AccordionItem
            className="overflow-hidden rounded-lg border border-slate-800 bg-[#1d2230] px-2 py-1 data-[state=open]:bg-[#202739]"
            key={workspace.id}
            value={workspace.slug}
          >
            <AccordionTrigger className="rounded-md px-1.5 py-1 text-sm text-slate-200 hover:bg-slate-800/60 [&_.accordion-chevron]:text-slate-400">
              <span className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-400 to-violet-500 text-xs font-semibold text-slate-100">
                  {workspace.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="line-clamp-1 text-sm font-medium">{workspace.name}</span>
              </span>
            </AccordionTrigger>

            <AccordionContent className="pb-1">
              <div className="ml-3 space-y-1 border-l border-slate-800 pl-3">
                <Link
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800/70 hover:text-white"
                  href={APP_ROUTES.workspace.indexBySlug(workspace.slug)}
                >
                  <span className="text-slate-400">
                    <SidebarIcon name="boards" />
                  </span>
                  <span>Bảng</span>
                </Link>
                <div className="flex items-center gap-1">
                  <Link
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800/70 hover:text-white"
                    href={workspaceMembersHref}
                  >
                    <span className="text-slate-400">
                      <SidebarIcon name="members" />
                    </span>
                    <span>Thành viên</span>
                  </Link>
                  <Link
                    aria-label={`Thêm thành viên vào ${workspace.name}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-lg font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                    href={workspaceMembersHref}
                  >
                    +
                  </Link>
                </div>
                <Link
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800/70 hover:text-white"
                  href={workspaceSettingsHref}
                >
                  <span className="text-slate-400">
                    <SidebarIcon name="settings" />
                  </span>
                  <span>Cài đặt</span>
                </Link>
                <p className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-400">
                  <SidebarIcon name="billing" />
                  <span>Thanh toán</span>
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

export function WorkspaceSidebar({
  activeWorkspaceSlug,
  messageType,
  statusMessage,
  workspaces,
}: WorkspaceSidebarProps) {
  const isSuccessMessage = messageType === "success";
  const expandedWorkspaceSlug =
    activeWorkspaceSlug && workspaces.some((workspace) => workspace.slug === activeWorkspaceSlug)
      ? activeWorkspaceSlug
      : workspaces[0]?.slug;

  return (
    <aside className="space-y-4 rounded-xl border border-slate-800 bg-[#171b24] p-3">
      <nav className="space-y-1">
        <SidebarNavLink active href={APP_ROUTES.workspace.index} icon="boards" label="Bảng" />
        <SidebarNavLink href={APP_ROUTES.workspace.search} icon="templates" label="tìm kiếm" />
        <SidebarNavLink href={APP_ROUTES.home} icon="home" label="Trang chủ" />
      </nav>

      <div className="border-t border-slate-800" />

      <div className="space-y-2">
        <p className="px-2 text-xs font-semibold text-slate-500">Các Không gian làm việc</p>
        <WorkspaceMenu expandedWorkspaceSlug={expandedWorkspaceSlug} workspaces={workspaces} />
      </div>

      <details className="rounded-lg border border-slate-800 bg-[#1b202c]" open={Boolean(statusMessage)}>
        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-slate-200">
          + Tạo không gian làm việc
        </summary>
        {statusMessage ? (
          <p
            className={
              isSuccessMessage
                ? "mx-3 mb-2 rounded-md border border-emerald-700/60 bg-emerald-950/30 px-2 py-1.5 text-xs text-emerald-200"
                : "mx-3 mb-2 rounded-md border border-rose-800/60 bg-rose-950/30 px-2 py-1.5 text-xs text-rose-200"
            }
          >
            {statusMessage}
          </p>
        ) : null}
        <form action={createWorkspace} className="space-y-2 border-t border-slate-800 p-3">
          <Label className="text-xs text-slate-300" htmlFor="workspace-name">
            Tên không gian làm việc
          </Label>
          <Input
            className="min-h-10 border-slate-700 bg-[#11141a] text-slate-100 placeholder:text-slate-500"
            id="workspace-name"
            name="name"
            placeholder="Marketing team"
            required
          />
          <SubmitButton className="min-h-10 w-full" pendingLabel="Creating workspace...">
            Tạo không gian
          </SubmitButton>
        </form>
      </details>
    </aside>
  );
}
