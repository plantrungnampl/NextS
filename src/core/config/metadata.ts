import type { Metadata } from "next";

import { APP_CONFIG } from "./app-config";

export const ROOT_METADATA: Metadata = {
  title: APP_CONFIG.title,
  description: APP_CONFIG.description,
};
