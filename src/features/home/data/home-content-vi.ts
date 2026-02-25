import {
  Bot,
  BriefcaseBusiness,
  Cable,
  Code2,
  GraduationCap,
  Handshake,
  KanbanSquare,
  Megaphone,
  Smartphone,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { APP_ROUTES } from "@/core";
import type {
  BoardColumnPreview,
  BrandLogoItem,
  FeatureCard,
  FooterGroup,
  HeroCta,
  NavLink,
  TestimonialItem,
  UseCaseItem,
} from "../types";
import type { HomeContent } from "./home-content.schema";
const trustedLogos: ReadonlyArray<BrandLogoItem> = [
  { name: "Stripe" },
  { name: "Shopify" },
  { name: "Zoom" },
  { name: "Spotify" },
  { name: "Figma" },
  { name: "Atlassian" },
];
const navLinks: ReadonlyArray<NavLink> = [
  { id: "features", label: "Tính năng", href: "#features" },
  { id: "solutions", label: "Giải pháp", href: "#use-cases" },
  { id: "templates", label: "Mẫu", href: "#demo" },
  { id: "pricing", label: "Bảng giá", href: "#final-cta" },
  { id: "resources", label: "Tài nguyên", href: "#footer" },
];
const heroCtas: ReadonlyArray<HeroCta> = [
  {
    label: "Bắt đầu miễn phí",
    href: APP_ROUTES.login,
    variant: "primary",
    ariaLabel: "Bắt đầu miễn phí với NextS",
  },
  {
    label: "Xem demo 1:45",
    href: "#demo",
    variant: "secondary",
    ariaLabel: "Xem video demo một phút bốn mươi lăm giây",
  },
];
const heroBoardColumns: ReadonlyArray<BoardColumnPreview> = [
  {
    title: "Đã lên kế hoạch",
    cardCount: 8,
    cards: [
      {
        title: "Checklist onboarding cho launch",
        label: "Marketing",
        labelClassName: "bg-[#E3F2FD] text-[#005A8C]",
        members: ["AL", "TS"],
        dueDate: "22/05",
        checklist: "2/5",
      },
      {
        title: "Giảm tỉ lệ rơi ở bước đăng ký",
        label: "Growth",
        labelClassName: "bg-[#E8F5E9] text-[#136F3A]",
        members: ["ME", "HX"],
        dueDate: "24/05",
        checklist: "1/3",
      },
    ],
  },
  {
    title: "Đang làm",
    cardCount: 5,
    cards: [
      {
        title: "Card composer với slash menu",
        label: "Product",
        labelClassName: "bg-[#FFF4E5] text-[#8A4B00]",
        members: ["QN", "TR", "AN"],
        dueDate: "19/05",
        checklist: "4/7",
      },
      {
        title: "Đồng bộ quyền board realtime",
        label: "Platform",
        labelClassName: "bg-[#F1F0FF] text-[#4E44CE]",
        members: ["PM", "LK"],
        dueDate: "20/05",
        checklist: "3/4",
      },
    ],
  },
  {
    title: "Chờ duyệt",
    cardCount: 3,
    cards: [
      {
        title: "Ma trận test automation rules",
        label: "QA",
        labelClassName: "bg-[#E0F7FA] text-[#00626B]",
        members: ["NH", "DV"],
        dueDate: "18/05",
        checklist: "6/6",
      },
      {
        title: "Snapshot tiến độ cho leadership",
        label: "Ops",
        labelClassName: "bg-[#FCE4EC] text-[#8D1B4C]",
        members: ["GT"],
        dueDate: "21/05",
        checklist: "2/2",
      },
    ],
  },
];
const featureCards: ReadonlyArray<FeatureCard> = [
  {
    title: "Kanban trực quan",
    description:
      "Sắp ưu tiên theo cột, metadata và workflow linh hoạt để team nắm trạng thái chỉ trong vài giây.",
    icon: KanbanSquare,
    href: "#demo",
  },
  {
    title: "Cộng tác realtime",
    description:
      "Theo dõi người đang online, cập nhật thẻ và bình luận tức thời, không cần refresh thủ công.",
    icon: Users,
    href: "#testimonials",
  },
  {
    title: "Butler automation",
    description:
      "Tự động hóa tác vụ lặp lại bằng trigger và action để luồng công việc chạy liên tục.",
    icon: Workflow,
    href: "#demo",
  },
  {
    title: "Gợi ý thông minh bằng AI",
    description:
      "AI đề xuất nhãn, deadline và bước tiếp theo theo ngữ cảnh để bắt đầu kế hoạch nhanh hơn.",
    icon: Bot,
    href: "#features",
  },
  {
    title: "Mobile theo kịp tiến độ",
    description:
      "Ghi nhanh ý tưởng, kéo thả card và xử lý việc gấp ngay trên điện thoại.",
    icon: Smartphone,
    href: "#use-cases",
  },
  {
    title: "Tích hợp và Power-Ups",
    description:
      "Kết nối NextS với Slack, Drive, Jira, GitHub và workflow nội bộ của bạn.",
    icon: Cable,
    href: "#footer",
  },
];
const demoBoardColumns: ReadonlyArray<BoardColumnPreview> = [
  {
    title: "Công việc mới",
    cardCount: 11,
    cards: [
      {
        title: "Tổng hợp yêu cầu campaign launch",
        label: "Intake",
        labelClassName: "bg-[#E3F2FD] text-[#005A8C]",
        members: ["MP", "AN"],
        dueDate: "Hôm nay",
        checklist: "1/4",
      },
      {
        title: "Soạn script webinar khách hàng",
        label: "Content",
        labelClassName: "bg-[#FFF4E5] text-[#8A4B00]",
        members: ["TL"],
        dueDate: "Ngày mai",
        checklist: "2/6",
      },
    ],
  },
  {
    title: "Đang triển khai",
    cardCount: 7,
    cards: [
      {
        title: "Tinh chỉnh thư viện template board",
        label: "Template",
        labelClassName: "bg-[#F1F0FF] text-[#4E44CE]",
        members: ["LX", "PR"],
        dueDate: "23/05",
        checklist: "5/8",
      },
      {
        title: "AI gợi ý bước tiếp theo",
        label: "AI",
        labelClassName: "bg-[#E0F7FA] text-[#00626B]",
        members: ["HT", "DR"],
        dueDate: "24/05",
        checklist: "4/5",
      },
    ],
  },
  {
    title: "Đã xong",
    cardCount: 14,
    cards: [
      {
        title: "Tự assign theo skill tag",
        label: "Automation",
        labelClassName: "bg-[#E8F5E9] text-[#136F3A]",
        members: ["SM", "KR"],
        dueDate: "Hoàn tất",
        checklist: "3/3",
      },
      {
        title: "Luồng ghi nhanh trên iOS",
        label: "Mobile",
        labelClassName: "bg-[#FCE4EC] text-[#8D1B4C]",
        members: ["RX"],
        dueDate: "Hoàn tất",
        checklist: "4/4",
      },
    ],
  },
];
const useCases: ReadonlyArray<UseCaseItem> = [
  {
    title: "Team Marketing",
    description:
      "Điều phối campaign với owner rõ ràng, timeline launch và bước duyệt sáng tạo trong một board.",
    metric: "Bàn giao campaign nhanh hơn 32%",
    icon: Megaphone,
  },
  {
    title: "Team Engineering",
    description:
      "Lập kế hoạch sprint, theo dõi phụ thuộc và đồng bộ trạng thái product + engineering theo thời gian thực.",
    metric: "Tốc độ planning sprint tăng 2.1x",
    icon: Code2,
  },
  {
    title: "Team Nhân sự",
    description:
      "Chuẩn hóa pipeline tuyển dụng và checklist onboarding bằng template workflow có thể tái sử dụng.",
    metric: "Giảm 45% nhắc việc thủ công",
    icon: BriefcaseBusiness,
  },
  {
    title: "Giáo dục",
    description:
      "Điều phối dự án lớp học, duyệt bài tập và milestone cho từng nhóm học viên.",
    metric: "89% bài nộp đúng hạn",
    icon: GraduationCap,
  },
  {
    title: "Kế hoạch cá nhân",
    description:
      "Quản lý mục tiêu, thói quen và side project bằng board gọn nhẹ nhưng luôn rõ ràng.",
    metric: "Lên plan mỗi ngày dưới 5 phút",
    icon: Sparkles,
  },
  {
    title: "Vận hành",
    description:
      "Chuẩn hóa quy trình lặp lại và tự động hóa liên team mà không còn phụ thuộc spreadsheet rời rạc.",
    metric: "Giảm 27% sự cố vận hành",
    icon: Handshake,
  },
];
const testimonials: ReadonlyArray<TestimonialItem> = [
  {
    quote:
      "NextS thay thế ba công cụ rời rạc chỉ trong hai tuần. Board launch giờ phản ánh đúng tiến độ theo từng giờ.",
    name: "Lena Park",
    role: "Head of Product",
    company: "PilotLoop",
    avatar: "LP",
  },
  {
    quote:
      "Board rất sống động. Kéo thả mượt, automation ổn định và team thực sự thích dùng mỗi ngày.",
    name: "Marco Silva",
    role: "Engineering Manager",
    company: "Northstack",
    avatar: "MS",
  },
  {
    quote:
      "Bọn mình đưa toàn bộ campaign planning vào NextS và giảm một nửa họp trạng thái hằng tuần mà vẫn đủ visibility.",
    name: "Ava Tran",
    role: "Marketing Director",
    company: "Nebula Labs",
    avatar: "AT",
  },
  {
    quote:
      "Ứng dụng mobile giúp đội vận hành ngoài hiện trường luôn cùng một nhịp. Cập nhật đến ngay và ưu tiên luôn đồng nhất.",
    name: "Chris Walker",
    role: "Operations Lead",
    company: "Flowpoint",
    avatar: "CW",
  },
  {
    quote:
      "AI gợi ý vừa đủ và hữu ích. Nhân sự mới onboarding nhanh hơn vì card dễ triage hơn nhiều.",
    name: "Nora Lee",
    role: "People Ops Manager",
    company: "BasisOne",
    avatar: "NL",
  },
  {
    quote:
      "Power-Ups giúp chuyển đổi mượt. Team nối Slack và GitHub trong vài phút và giảm rõ rệt context switching.",
    name: "Ibrahim Khan",
    role: "CTO",
    company: "Threadline",
    avatar: "IK",
  },
];
const footerGroups: ReadonlyArray<FooterGroup> = [
  {
    title: "Sản phẩm",
    links: [
      { label: "Tính năng", href: "#features" },
      { label: "Mẫu", href: "#demo" },
      { label: "Ứng dụng mobile", href: "#features" },
      { label: "Bảng giá", href: "#final-cta" },
    ],
  },
  {
    title: "Giải pháp",
    links: [
      { label: "Marketing", href: "#use-cases" },
      { label: "Engineering", href: "#use-cases" },
      { label: "Vận hành", href: "#use-cases" },
      { label: "Giáo dục", href: "#use-cases" },
    ],
  },
  {
    title: "Tài nguyên",
    links: [
      { label: "Trung tâm trợ giúp", href: "#footer" },
      { label: "Cộng đồng", href: "#footer" },
      { label: "Tài liệu API", href: "#footer" },
      { label: "Nhật ký cập nhật", href: "#footer" },
    ],
  },
  {
    title: "Công ty",
    links: [
      { label: "Về chúng tôi", href: "#footer" },
      { label: "Tuyển dụng", href: "#footer" },
      { label: "Bảo mật", href: "#footer" },
      { label: "Liên hệ", href: "#footer" },
    ],
  },
  {
    title: "Pháp lý",
    links: [
      { label: "Điều khoản", href: "#footer" },
      { label: "Quyền riêng tư", href: "#footer" },
      { label: "Chính sách cookie", href: "#footer" },
      { label: "Trạng thái hệ thống", href: "#footer" },
    ],
  },
];
export const homeContentVi: HomeContent = {
  locale: "vi",
  metadata: {
    title: "NextS | Cộng tác trực quan cho team hiện đại",
    description:
      "Lập kế hoạch và giao việc nhanh hơn với bảng Kanban, cộng tác realtime, Butler automation và AI gợi ý.",
    alternates: {
      canonical: "/vi",
      languages: {
        en: "/",
        vi: "/vi",
      },
    },
  },
  skipToMainLabel: "Bỏ qua và đến nội dung chính",
  brand: {
    iconLabel: "NS",
    name: "NextS",
    subtitle: "Cộng tác trực quan",
    homeHref: APP_ROUTES.homeVi,
    homeAriaLabel: "Trang chủ NextS",
    localeSwitchHref: APP_ROUTES.home,
    localeSwitchLabel: "EN",
    localeDisplayLabel: "Tiếng Việt (VN)",
  },
  header: {
    loginLabel: "Đăng nhập",
    getStartedLabel: "Dùng miễn phí",
    workspaceLabel: "Vào workspace",
    primaryNavAriaLabel: "Điều hướng chính",
    mobileNavAriaLabel: "Điều hướng trên di động",
    openMenuAriaLabel: "Mở menu điều hướng",
    closeMenuAriaLabel: "Đóng menu điều hướng",
  },
  navLinks,
  hero: {
    badge: "Cộng tác trực quan, vận hành thật",
    title: "Luồng công việc mượt hơn khi team làm việc trên board trực quan",
    description:
      "Lập kế hoạch bằng Kanban, kéo thả card linh hoạt và đồng bộ team qua cập nhật realtime, AI suggestions và Butler automation.",
    ctas: heroCtas,
    boardColumns: heroBoardColumns,
    liveBadge: "12 thành viên đang online",
  },
  trusted: {
    title: "Được tin dùng bởi các team tại",
    logos: trustedLogos,
  },
  features: {
    eyebrow: "Tính năng cốt lõi",
    title: "Mọi thứ team cần để lập kế hoạch và giao việc",
    description:
      "Từ board trực quan đến automation và AI, NextS giúp luồng thực thi luôn rõ ràng, nhanh và dễ theo dõi.",
    learnMoreLabel: "Xem thêm",
    cards: featureCards,
  },
  demo: {
    eyebrow: "Xem thực tế",
    title: "Một board cho cảm giác tương tác ngay từ lần chạm đầu",
    description:
      "Mô phỏng luồng công việc sinh động với chuyển động card, timeline cập nhật và insight từ automation.",
    boardColumns: demoBoardColumns,
    liveBadge: "Timeline realtime đã đồng bộ",
    timelineTitle: "Dòng hoạt động",
    timelineEvents: [
      {
        title: "Rule kích hoạt: tự assign PM review",
        time: "2 giây trước",
      },
      {
        title: "AI đề xuất deadline cho card launch",
        time: "18 giây trước",
      },
      {
        title: "Board đã sync với ứng dụng mobile",
        time: "1 phút trước",
      },
    ],
    aiBadge: "AI đang bật",
    butlerBadge: "Butler đang chạy",
    templateButtonLabel: "Dùng thử template này",
  },
  useCases: {
    eyebrow: "Cho mọi team",
    title: "Dùng NextS đúng theo cách team của bạn vận hành",
    description:
      "Workflow thiết kế sẵn cho marketing, engineering, HR, giáo dục, vận hành và kế hoạch cá nhân.",
    items: useCases,
  },
  testimonials: {
    eyebrow: "Khách hàng nói gì",
    title: "Được yêu thích bởi các team giao việc mỗi tuần",
    description:
      "Chia sẻ thực tế từ product, engineering, marketing và vận hành khi dùng NextS mỗi ngày.",
    dotAriaLabel: "Xem đánh giá",
    previousAriaLabel: "Đánh giá trước",
    nextAriaLabel: "Đánh giá tiếp theo",
    items: testimonials,
  },
  finalCta: {
    eyebrow: "Sẵn sàng khi team của bạn sẵn sàng",
    title: "Sẵn sàng tổ chức lại cách team vận hành?",
    description:
      "Bắt đầu miễn phí trong vài phút, mời team tức thì và biến công việc đến thành workflow trực quan ai cũng tin được.",
    primaryLabel: "Bắt đầu miễn phí",
    primaryHref: APP_ROUTES.login,
    secondaryLabel: "Liên hệ sales",
    secondaryHref: "#footer",
  },
  footer: {
    description: "NextS giúp team trực quan hóa công việc, tự động hóa quy trình và giao việc cùng nhau.",
    socialAriaLabel: "Liên kết mạng xã hội",
    groups: footerGroups,
    copyright: "© 2026 NextS, Inc. Bảo lưu mọi quyền.",
  },
};
