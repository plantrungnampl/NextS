import type { CSSProperties } from "react";
import { Globe2, Lock, Users, type LucideIcon } from "lucide-react";

export type BoardBackgroundOption = {
  id: string;
  label: string;
  previewClassName: string;
  style: CSSProperties;
};

export type VisibilityValue = "workspace" | "private" | "public";

export type VisibilityOption = {
  description: string;
  icon: LucideIcon;
  label: string;
  value: VisibilityValue;
};

export const BOARD_BACKGROUNDS: BoardBackgroundOption[] = [
  {
    id: "twilight",
    label: "Indigo",
    previewClassName: "from-indigo-600 via-violet-500 to-fuchsia-500",
    style: { backgroundImage: "linear-gradient(135deg, #4f46e5 0%, #8b5cf6 55%, #d946ef 100%)" },
  },
  {
    id: "ocean",
    label: "Ocean",
    previewClassName: "from-sky-600 via-cyan-500 to-blue-500",
    style: { backgroundImage: "linear-gradient(135deg, #0369a1 0%, #06b6d4 55%, #2563eb 100%)" },
  },
  {
    id: "forest",
    label: "Forest",
    previewClassName: "from-emerald-700 via-teal-500 to-green-500",
    style: { backgroundImage: "linear-gradient(135deg, #047857 0%, #14b8a6 55%, #22c55e 100%)" },
  },
  {
    id: "sunset",
    label: "Sunset",
    previewClassName: "from-orange-700 via-amber-500 to-yellow-400",
    style: { backgroundImage: "linear-gradient(135deg, #b45309 0%, #f59e0b 55%, #facc15 100%)" },
  },
  {
    id: "ember",
    label: "Ember",
    previewClassName: "from-rose-700 via-pink-600 to-fuchsia-600",
    style: { backgroundImage: "linear-gradient(135deg, #be123c 0%, #db2777 55%, #c026d3 100%)" },
  },
  {
    id: "slate",
    label: "Slate",
    previewClassName: "from-slate-700 via-slate-600 to-slate-500",
    style: { backgroundImage: "linear-gradient(135deg, #334155 0%, #475569 55%, #64748b 100%)" },
  },
];

export const VISIBILITY_OPTIONS: VisibilityOption[] = [
  {
    description: "Thành viên trong workspace có thể xem.",
    icon: Users,
    label: "Không gian làm việc",
    value: "workspace",
  },
  {
    description: "Chỉ bạn và người được mời mới xem được.",
    icon: Lock,
    label: "Riêng tư",
    value: "private",
  },
  {
    description: "Bất kỳ ai có link đều xem được.",
    icon: Globe2,
    label: "Công khai",
    value: "public",
  },
];

export const MODAL_QUERY_KEYS = ["createBoard", "createBoardMessage", "createBoardType", "workspace"] as const;
