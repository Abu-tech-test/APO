import houseData from "../data/houses.json";
import locationData from "../data/locations.json";
import dailyTeleportData from "../data/dailyTeleports.json";
import monsterData from "../data/monsters.json";
import npcData from "../data/npcs.json";
import type { Monster } from "../types";

export type MapNpcLocation = {
  floor: number;
  x: number;
  y: number;
};

export type MapHouse = {
  id: number;
  name: string;
  region: string;
  position: MapNpcLocation;
};

export type MapLocation = {
  id: number;
  name: string;
  description: string;
  position: MapNpcLocation;
};

export type MapNpcMapRequest = {
  npcId: number;
  position: MapNpcLocation;
};

export type MapMonsterMapRequest = {
  monsterId?: number;
  marker?: {
    categoryId: number;
    positionIndex: number;
    floor: number;
    x: number;
    y: number;
  };
};

export type MonsterMapTuple = readonly [number, number, number];

export type MonsterMapCategory = {
  id: number;
  name: string;
  monsterIds: number[];
  positions: MonsterMapTuple[];
};

export type MapMarkerLayer =
  | ""
  | "npcs"
  | "monsters"
  | "houses"
  | "locations"
  | "teleports";

export type NPC = {
  id: number;
  name: string;
  region: string;
  category: string;
  location: string;
  profession?: string | null;
  description: string;
  image: string;
  locationImage?: string;
  mapOnly?: boolean;
  mapPositions?: MapNpcLocation[];
};

export type MapNpcPosition = {
  npcId: number;
  floor: number;
  x: number;
  y: number;
};

export type DailyTeleportPosition = {
  day: number;
  x: number;
  y: number;
};

export const dailyTeleports: {
  floor: number;
  center: { x: number; y: number };
  positions: DailyTeleportPosition[];
} = dailyTeleportData;

export const monsters: Monster[] = monsterData;
export const allNpcs: NPC[] = npcData;
export const npcs = allNpcs.filter((npc) => !npc.mapOnly);
export const houses: MapHouse[] = houseData;
export const locations: MapLocation[] = locationData;
export const mapNpcPositions: MapNpcPosition[] = [
  ...allNpcs.flatMap((npc) =>
    (npc.mapPositions ?? []).map((position) => ({
      npcId: npc.id,
      ...position,
    })),
  ),
];

export const mapFloors = Array.from({ length: 16 }, (_, index) => 7 - index);
export const mapDimensions = { width: 2112, height: 1536 };
export const defaultMapZoom = 1;
export const maxMapZoom = 16;

export function getMapPositionKey(position: MapNpcPosition) {
  return `${position.npcId}:${position.floor}:${position.x}:${position.y}`;
}

export function getMapMonsterPositionKey(
  categoryId: number,
  positionIndex: number,
) {
  return `${categoryId}:${positionIndex}`;
}
