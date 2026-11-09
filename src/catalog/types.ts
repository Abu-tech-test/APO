import type { Item, ItemZone, Monster } from "../types";
import type { NPC } from "../map/mapData";

export type BossRegionData = {
  name: string;
  bosses: {
    name: string;
    lookType: number;
    outfitColors: { head: number; body: number; legs: number; feet: number };
    description: string;
    image?: string;
    lootMonsterId?: number;
  }[];
};

export type Boss = BossRegionData["bosses"][number] & { region: string };

export type CatalogEntry =
  | { section: "monsters"; name: string; caption: string; monster: Monster }
  | { section: "items"; name: string; caption: string; item: Item }
  | { section: "bosses"; name: string; caption: string; boss: Boss }
  | { section: "npcs"; name: string; caption: string; npc: NPC };

export type ZoneFilter = "all" | ItemZone;
