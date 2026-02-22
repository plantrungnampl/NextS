export const DEFAULT_LABEL_PRESETS = [
  { color: "#4BCE97", name: "Xanh lá" },
  { color: "#E2B203", name: "Vàng" },
  { color: "#FAA53D", name: "Cam" },
  { color: "#F87168", name: "Đỏ" },
  { color: "#9F8FEF", name: "Tím" },
  { color: "#579DFF", name: "Xanh dương" },
] as const;

export const DEFAULT_LABEL_COLOR_ORDER = DEFAULT_LABEL_PRESETS.map((preset) => preset.color.toLowerCase());

export const QUICK_LABEL_COLOR_PALETTE = [
  "#216E4E", "#7F5F01", "#974F0C", "#AE2E24", "#5E4DB2",
  "#4BCE97", "#E2B203", "#FAA53D", "#F87168", "#9F8FEF",
  "#6CC3E0", "#94C748", "#C0B6F2", "#F9A7B0", "#8B949E",
  "#1D4F8C", "#165A72", "#4E6B1F", "#8C3A68", "#596773",
  "#0C66E4", "#22A0C8", "#5B8A1A", "#AE4787", "#6B7280",
  "#85B8FF", "#93C5FD", "#A3D977", "#F472B6", "#D1D5DB",
] as const;
