export interface LootEntry {
  name: string;
  frequency: string;
  amount: number;
}

export interface Monster {
  id: number;
  name: string;
  hp: number;
  exp: number;
  loot: LootEntry[];
}

export interface ItemDrop {
  monster: Monster;
  loot: LootEntry;
}

export type ItemZone = "main" | "rook";

export interface Item {
  name: string;
  drops: ItemDrop[];
  clientId?: number;
  subType?: number;
  categories?: string[];
  zones?: ItemZone[];
  descriptions?: Partial<Record<ItemZone, string>>;
}
