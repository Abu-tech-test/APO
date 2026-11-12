import graphics from "../data/graphics.json";
import type { Item, ItemZone, Monster } from "../types";
import type { Boss } from "./types";

const graphicsByName: {
  monsters: Record<string, string>;
  monsterVariants: Record<number, string>;
  items: Record<string, string>;
} = graphics;

const lootFrequencyOrder: Record<string, number> = {
  Unknown: -1,
  Zawsze: 0,
  "Bardzo czesto": 1,
  Czesto: 2,
  Srednio: 3,
  Rzadko: 4,
  "Bardzo rzadko": 5,
  "Niespotykanie rzadko": 6,
};

export function compareLootFrequency(
  a: { frequency: string },
  b: { frequency: string },
) {
  return (
    (lootFrequencyOrder[a.frequency] ?? Number.MAX_SAFE_INTEGER) -
    (lootFrequencyOrder[b.frequency] ?? Number.MAX_SAFE_INTEGER)
  );
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("pl-PL").format(value);
}

export function formatLootAmount(amount: number) {
  return amount > 1 ? `1–${formatNumber(amount)}` : "1";
}

export function getMonsterImage(monster: Pick<Monster, "id" | "name">) {
  return (
    graphicsByName.monsterVariants[monster.id] ??
    graphicsByName.monsters[monster.name]
  );
}

export function getBossImage(boss: Pick<Boss, "name" | "image">) {
  return graphicsByName.monsters[boss.name] ?? boss.image;
}

export function getItemImage(name: string) {
  return graphicsByName.items[name.toLocaleLowerCase("pl")];
}

export function getCatalogItemImage(item: Item) {
  const mappedImage = getItemImage(item.name);
  if (item.clientId === 2874 && mappedImage) return mappedImage;

  return item.clientId
    ? `./images/items/${item.clientId}.webp`
    : mappedImage;
}

export function getItemCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    helmy: "Hełmy",
    zbroje: "Zbroje",
    legi: "Legi",
    buty: "Buty",
    bronie: "Bronie",
    tarcze: "Tarcze",
    amulety: "Amulety",
    ringi: "Ring",
    zadaniowe: "Zadaniowe",
    pozostale: "Pozostałe",
  };
  return labels[category] ?? category;
}

export function getBossRegionLabel(region: string) {
  return region === "OKOLICZNOSCIOWE" ? "Okolicznościowe" : region;
}

export function itemMatchesZone(item: Item, zone: "all" | ItemZone) {
  return zone === "all" || !item.zones?.length || item.zones.includes(zone);
}
