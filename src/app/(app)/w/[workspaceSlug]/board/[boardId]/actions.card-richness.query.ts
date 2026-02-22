"use server";

import { z } from "zod";

import { boardPathSchema } from "./actions.card-richness.shared";
import { getCardRichnessSnapshotData } from "./card-richness.data";
import type { CardRichnessSnapshot } from "./types";

const cardRichnessQuerySchema = boardPathSchema.extend({
  cardId: z.uuid(),
});

export async function queryCardRichnessSnapshot(input: unknown): Promise<CardRichnessSnapshot> {
  const parsed = cardRichnessQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid card richness request.");
  }

  return getCardRichnessSnapshotData(parsed.data);
}
