import { HomePage } from "@/features/home";
import { getHomeMetadata } from "@/features/home/data/home-content";

export const metadata = getHomeMetadata("vi");

export default function VietnameseHomePage() {
  return <HomePage locale="vi" />;
}
