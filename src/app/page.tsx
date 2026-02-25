import { HomePage } from "@/features/home";
import { getHomeMetadata } from "@/features/home/data/home-content";

export const metadata = getHomeMetadata("en");

export default function MarketingHomePage() {
  return <HomePage locale="en" />;
}
