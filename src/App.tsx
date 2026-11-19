import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import bossData from "./data/bosses.json";
import informationData from "./data/information.json";
import itemCatalogData from "./data/items.json";
import systemData from "./data/systems.json";
import type { Item, ItemZone, Monster } from "./types";
import type { InformationCategory } from "./information/types";
import type { GameSystem } from "./systems/types";
import type { Boss, BossRegionData, CatalogEntry } from "./catalog/types";
import type { GlobalSearchResult } from "./search/GlobalSearchWorkspace";
import {
  formatNumber,
  getBossRegionLabel,
  itemMatchesZone,
} from "./catalog/utils";
import {
  allNpcs,
  dailyTeleports,
  houses,
  locations,
  mapDimensions,
  mapNpcPositions,
  npcs,
} from "./map/mapData";
import type {
  MapMonsterMapRequest,
  MapNpcLocation,
  MapNpcMapRequest,
  MonsterMapCategory,
  NPC,
} from "./map/mapData";

const MapWorkspace = lazy(() => import("./map/MapWorkspace"));
const InformationWorkspace = lazy(() =>
  import("./information/InformationWorkspace").then((module) => ({
    default: module.InformationWorkspace,
  })),
);
const SystemsWorkspace = lazy(() =>
  import("./systems/SystemsWorkspace").then((module) => ({
    default: module.SystemsWorkspace,
  })),
);
const CatalogWorkspace = lazy(() => import("./catalog/CatalogWorkspace"));
const InformationDetails = lazy(() =>
  import("./catalog/Details").then((module) => ({
    default: module.InformationDetails,
  })),
);
const GlobalSearchWorkspace = lazy(() =>
  import("./search/GlobalSearchWorkspace").then((module) => ({
    default: module.GlobalSearchWorkspace,
  })),
);

const systems: GameSystem[] = systemData;
const informationCategories: InformationCategory[] = informationData;
type ItemCatalogRecord = Omit<Item, "drops">;
const itemCatalog: ItemCatalogRecord[] = itemCatalogData.map((item) => ({
  ...item,
  zones: item.zones.filter(
    (zone): zone is ItemZone => zone === "main" || zone === "rook",
  ),
}));
const itemAliases = new Map(
  itemCatalog.flatMap((item) =>
    (item.alternativeNames ?? []).map((name) => [
      name.toLocaleLowerCase("pl"),
      item.name.toLocaleLowerCase("pl"),
    ] as const),
  ),
);

const bossRegions: BossRegionData[] = bossData;
const bosses: Boss[] = bossRegions.flatMap((region) =>
  region.bosses.map((boss) => ({ ...boss, region: region.name })),
);

const pageSize = 10;

type Section =
  | "search"
  | "map"
  | "monsters"
  | "items"
  | "bosses"
  | "npcs"
  | "info"
  | "systems";
type ZoneFilter = "all" | ItemZone;
type MapPointRequest =
  | { kind: "location" | "house"; id: number }
  | { kind: "teleport"; day: number };
type AppNavigationEntry = {
  version: 1;
  section: Section;
  query: string;
  page: number;
  selectedMonsterId: number;
  selectedItemName: string;
  selectedItemZone: ZoneFilter;
  selectedBossName: string;
  selectedBossRegion: string;
  selectedNpcId: number | null;
  selectedNpcRegion: string;
  selectedNpcCategory: string;
  selectedInformationName: string;
  selectedSystemName: string;
  mapNpcRequest?: MapNpcMapRequest;
  mapMonsterRequest?: MapMonsterMapRequest;
};
const appNavigationStateKey = "apowikiNavigation";
const appNavigationQueryKeys = [
  "view",
  "q",
  "page",
  "monster",
  "item",
  "zone",
  "boss",
  "bossRegion",
  "npc",
  "npcRegion",
  "npcCategory",
  "info",
  "system",
  "npcFloor",
  "npcX",
  "npcY",
  "mapMonster",
  "monsterCategory",
  "monsterMarker",
  "monsterFloor",
  "monsterX",
  "monsterY",
];
function readNavigationFromUrl(monsters: Monster[]): AppNavigationEntry {
  const params = new URL(window.location.href).searchParams;
  const sectionParam = params.get("view");
  const sections: Section[] = [
    "search",
    "map",
    "monsters",
    "items",
    "bosses",
    "npcs",
    "info",
    "systems",
  ];
  const section = sections.includes(sectionParam as Section)
    ? (sectionParam as Section)
    : "search";
  const itemZone = params.get("zone");
  const selectedItemZone: ZoneFilter =
    itemZone === "main" || itemZone === "rook" ? itemZone : "all";
  const bossName = params.get("boss") ?? "";
  const bossRegion = params.get("bossRegion") ?? "all";
  const boss = bosses.find(
    (entry) =>
      entry.name === bossName &&
      (bossRegion === "all" || entry.region === bossRegion),
  );
  const npcId = Number(params.get("npc"));
  const npc = Number.isInteger(npcId)
    ? npcs.find((entry) => entry.id === npcId)
    : undefined;
  const npcRegionParam = params.get("npcRegion");
  const selectedNpcRegion =
    npcRegionParam === "MAIN" || npcRegionParam === "ROOK"
      ? npcRegionParam
      : "all";
  const npcCategoryParam = params.get("npcCategory");
  const selectedNpcCategory =
    npcCategoryParam &&
    npcs.some((entry) => entry.category === npcCategoryParam)
      ? npcCategoryParam
      : "all";
  const monsterId = Number(params.get("monster"));
  const monster = Number.isInteger(monsterId)
    ? monsters.find((entry) => entry.id === monsterId)
    : undefined;
  const infoName = params.get("info") ?? "";
  const systemName = params.get("system") ?? "";
  const readCoordinate = (key: string) => {
    const rawValue = params.get(key);
    if (rawValue === null || rawValue.trim() === "") return undefined;
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : undefined;
  };
  const mapFloor = readCoordinate("npcFloor");
  const mapX = readCoordinate("npcX");
  const mapY = readCoordinate("npcY");
  const requestedNpc =
    npc && mapFloor !== undefined && mapX !== undefined && mapY !== undefined
      ? {
          npcId: npc.id,
          position: { floor: mapFloor, x: mapX, y: mapY },
        }
      : undefined;
  const rawMonsterId = params.get("mapMonster");
  const requestedMonsterId =
    rawMonsterId === null ? undefined : Number(rawMonsterId);
  const requestedMonster =
    requestedMonsterId !== undefined && Number.isInteger(requestedMonsterId)
      ? monsters.find((entry) => entry.id === requestedMonsterId)
      : undefined;
  const categoryId = readCoordinate("monsterCategory");
  const positionIndex = readCoordinate("monsterMarker");
  const monsterFloor = readCoordinate("monsterFloor");
  const monsterX = readCoordinate("monsterX");
  const monsterY = readCoordinate("monsterY");
  const requestedMonsterMarker =
    categoryId !== undefined &&
    positionIndex !== undefined &&
    monsterFloor !== undefined &&
    monsterX !== undefined &&
    monsterY !== undefined &&
    Number.isInteger(categoryId) &&
    Number.isInteger(positionIndex) &&
    Number.isInteger(monsterFloor) &&
    Number.isInteger(monsterX) &&
    Number.isInteger(monsterY) &&
    categoryId >= 0 &&
    positionIndex >= 0 &&
    monsterFloor >= -8 &&
    monsterFloor <= 7 &&
    monsterX >= 0 &&
    monsterX <= mapDimensions.width &&
    monsterY >= 0 &&
    monsterY <= mapDimensions.height
      ? { categoryId, positionIndex, floor: monsterFloor, x: monsterX, y: monsterY }
      : undefined;

  return {
    version: 1,
    section,
    query: params.get("q") ?? "",
    page: Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1),
    selectedMonsterId: monster?.id ?? sortByName(monsters)[0]?.id ?? 0,
    selectedItemName: (params.get("item") ?? "").toLocaleLowerCase("pl"),
    selectedItemZone,
    selectedBossName: boss?.name ?? sortByName(bosses)[0]?.name ?? "",
    selectedBossRegion: boss ? bossRegion : "all",
    selectedNpcId: npc?.id ?? null,
    selectedNpcRegion,
    selectedNpcCategory,
    selectedInformationName: informationCategories.some(
      (entry) => entry.name === infoName,
    )
      ? infoName
      : informationCategories[0].name,
    selectedSystemName: systems.some((entry) => entry.name === systemName)
      ? systemName
      : systems[0]?.name ?? "",
    mapNpcRequest: requestedNpc,
    mapMonsterRequest: requestedMonster || requestedMonsterMarker
      ? {
          monsterId: requestedMonster?.id,
          marker: requestedMonsterMarker,
        }
      : undefined,
  };
}

function getNavigationUrl(entry: AppNavigationEntry) {
  const url = new URL(window.location.href);
  for (const key of appNavigationQueryKeys) url.searchParams.delete(key);
  url.searchParams.set("view", entry.section);
  if (entry.query) url.searchParams.set("q", entry.query);
  if (entry.page > 1) url.searchParams.set("page", String(entry.page));

  if (entry.section === "monsters") {
    url.searchParams.set("monster", String(entry.selectedMonsterId));
  } else if (entry.section === "items") {
    if (entry.selectedItemName) url.searchParams.set("item", entry.selectedItemName);
    if (entry.selectedItemZone !== "all") {
      url.searchParams.set("zone", entry.selectedItemZone);
    }
  } else if (entry.section === "bosses") {
    url.searchParams.set("boss", entry.selectedBossName);
    if (entry.selectedBossRegion !== "all") {
      url.searchParams.set("bossRegion", entry.selectedBossRegion);
    }
  } else if (entry.section === "npcs") {
    if (entry.selectedNpcId !== null) {
      url.searchParams.set("npc", String(entry.selectedNpcId));
    }
    if (entry.selectedNpcRegion !== "all") {
      url.searchParams.set("npcRegion", entry.selectedNpcRegion);
    }
    if (entry.selectedNpcCategory !== "all") {
      url.searchParams.set("npcCategory", entry.selectedNpcCategory);
    }
  } else if (entry.section === "info") {
    url.searchParams.set("info", entry.selectedInformationName);
  } else if (entry.section === "systems") {
    url.searchParams.set("system", entry.selectedSystemName);
  } else if (entry.mapNpcRequest) {
    url.searchParams.set("npc", String(entry.mapNpcRequest.npcId));
    url.searchParams.set(
      "npcFloor",
      String(entry.mapNpcRequest.position.floor),
    );
    url.searchParams.set("npcX", String(entry.mapNpcRequest.position.x));
    url.searchParams.set("npcY", String(entry.mapNpcRequest.position.y));
  } else if (entry.mapMonsterRequest) {
    if (entry.mapMonsterRequest.monsterId !== undefined) {
      url.searchParams.set(
        "mapMonster",
        String(entry.mapMonsterRequest.monsterId),
      );
    }
    if (entry.mapMonsterRequest.marker) {
      const { categoryId, positionIndex, floor, x, y } =
        entry.mapMonsterRequest.marker;
      url.searchParams.set("monsterCategory", String(categoryId));
      url.searchParams.set("monsterMarker", String(positionIndex));
      url.searchParams.set("monsterFloor", String(floor));
      url.searchParams.set("monsterX", String(x));
      url.searchParams.set("monsterY", String(y));
    }
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

function isValidMonsterMapRequest(
  value: unknown,
): value is MapMonsterMapRequest | undefined {
  if (value === undefined) return true;
  if (typeof value !== "object" || value === null) return false;
  const request = value as Partial<MapMonsterMapRequest>;
  const marker = request.marker;
  return (
    (request.monsterId !== undefined || marker !== undefined) &&
    (request.monsterId === undefined ||
      (typeof request.monsterId === "number" &&
        Number.isInteger(request.monsterId))) &&
    (marker === undefined ||
      (typeof marker === "object" &&
        marker !== null &&
        Number.isInteger(marker.categoryId) &&
        Number.isInteger(marker.positionIndex) &&
        Number.isInteger(marker.floor) &&
        Number.isInteger(marker.x) &&
        Number.isInteger(marker.y) &&
        marker.categoryId >= 0 &&
        marker.positionIndex >= 0 &&
        marker.floor >= -8 &&
        marker.floor <= 7 &&
        marker.x >= 0 &&
        marker.x <= mapDimensions.width &&
        marker.y >= 0 &&
        marker.y <= mapDimensions.height))
  );
}







function sortByName<T extends { name: string }>(entries: T[]) {
  return [...entries].sort((a, b) =>
    a.name.localeCompare(b.name, "pl", { sensitivity: "base" }),
  );
}

function getMonsterMapCategoryName(
  category: MonsterMapCategory,
  monsters: Monster[],
) {
  const normalizedName = category.name.toLocaleLowerCase("pl");
  const matchingMonster = monsters.find(
    (monster) =>
      category.monsterIds.includes(monster.id) &&
      monster.name.toLocaleLowerCase("pl") === normalizedName,
  );
  if (matchingMonster) return matchingMonster.name;

  return (
    category.name.charAt(0).toLocaleUpperCase("pl") + category.name.slice(1)
  );
}













function getItemSourceLabel(count: number) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;
  if (count === 1) return "1 źródło";
  if (lastTwoDigits < 12 || lastTwoDigits > 14) {
    if (lastDigit >= 2 && lastDigit <= 4) return `${count} źródła`;
  }
  return `${count} źródeł`;
}

function normalizeSearchText(value: string) {
  return value
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function App({ monsters }: { monsters: Monster[] }) {
  const [initialNavigation] = useState(() => readNavigationFromUrl(monsters));
  const [section, setSection] = useState<Section>(initialNavigation.section);
  const [query, setQuery] = useState(initialNavigation.query);
  const [page, setPage] = useState(initialNavigation.page);
  const [selectedMonster, setSelectedMonster] = useState<Monster>(
    () =>
      monsters.find(
        (monster) => monster.id === initialNavigation.selectedMonsterId,
      ) ?? sortByName(monsters)[0],
  );
  const [selectedItemName, setSelectedItemName] = useState(
    initialNavigation.selectedItemName,
  );
  const [selectedItemZone, setSelectedItemZone] = useState<ZoneFilter>(
    initialNavigation.selectedItemZone,
  );
  const [selectedBossRegion, setSelectedBossRegion] = useState(
    initialNavigation.selectedBossRegion,
  );
  const [selectedBoss, setSelectedBoss] = useState<Boss>(
    () =>
      bosses.find(
        (boss) =>
          boss.name === initialNavigation.selectedBossName &&
          boss.region === initialNavigation.selectedBossRegion,
      ) ?? sortByName(bosses)[0],
  );
  const [selectedNpcRegion, setSelectedNpcRegion] = useState(
    initialNavigation.selectedNpcRegion,
  );
  const [selectedNpcCategory, setSelectedNpcCategory] = useState(
    initialNavigation.selectedNpcCategory,
  );
  const [selectedNpc, setSelectedNpc] = useState<NPC | undefined>(
    initialNavigation.selectedNpcId === null
      ? undefined
      : npcs.find((npc) => npc.id === initialNavigation.selectedNpcId),
  );
  const [mapNpcRequest, setMapNpcRequest] = useState<
    MapNpcMapRequest | undefined
  >(
    initialNavigation.mapNpcRequest,
  );
  const [mapPointRequest, setMapPointRequest] = useState<
    MapPointRequest | undefined
  >();
  const [mapMonsterRequest, setMapMonsterRequest] =
    useState<MapMonsterMapRequest | undefined>(
      initialNavigation.mapMonsterRequest,
    );
  const [monsterMapCategories, setMonsterMapCategories] = useState<
    MonsterMapCategory[]
  >([]);
  const [monsterMapLoadStatus, setMonsterMapLoadStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [monsterMapLoadError, setMonsterMapLoadError] = useState("");
  const [selectedInformationName, setSelectedInformationName] = useState(
    initialNavigation.selectedInformationName,
  );
  const [selectedSystemName, setSelectedSystemName] = useState(
    initialNavigation.selectedSystemName,
  );
  const skipNextPageReset = useRef(true);
  const currentNavigationEntryRef = useRef<AppNavigationEntry | null>(null);

  function loadMonsterMapData() {
    if (
      monsterMapLoadStatus === "loading" ||
      monsterMapLoadStatus === "ready"
    ) {
      return;
    }

    setMonsterMapLoadStatus("loading");
    setMonsterMapLoadError("");
    void fetch(new URL("./data/monsterLocations.json", import.meta.url))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<MonsterMapCategory[]>;
      })
      .then((data) => {
        setMonsterMapCategories(
          data.map((category) => ({
            ...category,
            name: getMonsterMapCategoryName(category, monsters),
            positions: category.positions.map(
              ([floor, x, y]) => [floor, x, y] as const,
            ),
          })),
        );
        setMonsterMapLoadStatus("ready");
      })
      .catch((error: unknown) => {
        console.error("Nie udało się załadować lokalizacji potworów.", error);
        setMonsterMapLoadError(
          "Nie udało się załadować lokalizacji potworów. Spróbuj ponownie.",
        );
        setMonsterMapLoadStatus("error");
      });
  }

  useEffect(() => {
    if (
      section === "monsters" ||
      (section === "search" && query.trim().length > 0) ||
      mapMonsterRequest
    ) {
      loadMonsterMapData();
    }
  }, [section, mapMonsterRequest, query]);

  const monsterMapPositionCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const category of monsterMapCategories) {
      for (const monsterId of category.monsterIds) {
        counts.set(
          monsterId,
          (counts.get(monsterId) ?? 0) + category.positions.length,
        );
      }
    }
    return counts;
  }, [monsterMapCategories]);
  const mapMonsterSearchNames = useMemo(() => {
    const mappedMonsterIds = new Set(monsterMapPositionCounts.keys());
    return Array.from(
      new Set([
        ...monsters
          .filter((monster) => mappedMonsterIds.has(monster.id))
          .map((monster) => monster.name),
        ...monsterMapCategories
          .filter((category) => category.monsterIds.length === 0)
          .map((category) => category.name),
      ]),
    ).sort((a, b) => a.localeCompare(b, "pl", { sensitivity: "base" }));
  }, [monsterMapCategories, monsterMapPositionCounts]);

  const items = useMemo<Item[]>(() => {
    const itemMap = new Map<string, Item>(
      itemCatalog.map((item) => [
        item.name.toLocaleLowerCase("pl"),
        { ...item, drops: [] },
      ]),
    );

    for (const monster of monsters) {
      for (const loot of monster.loot) {
        const key = loot.name.toLocaleLowerCase("pl");
        const item = itemMap.get(itemAliases.get(key) ?? key);

        if (item) {
          item.drops.push({ monster, loot });
        } else {
          itemMap.set(key, {
            name: loot.name,
            drops: [{ monster, loot }],
          });
        }
      }
    }

    for (const category of informationCategories) {
      if (category.kind !== "costumes" || !category.entries) continue;

      for (const costume of category.entries) {
        for (const costumeItem of costume.items) {
          const key = costumeItem.name.toLocaleLowerCase("pl");
          if (!itemMap.has(key)) {
            itemMap.set(key, { name: costumeItem.name, drops: [] });
          }
        }
      }
    }

    return [...itemMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "pl", { sensitivity: "base" }),
    );
  }, []);

  const selectedItem =
    items
      .filter((item) => itemMatchesZone(item, selectedItemZone))
      .find(
        (item) =>
          item.name.toLocaleLowerCase("pl") === selectedItemName ||
          item.alternativeNames?.some(
            (name) => name.toLocaleLowerCase("pl") === selectedItemName,
          ),
      ) ??
    items.find((item) => itemMatchesZone(item, selectedItemZone));
  const visibleItems = useMemo(
    () => items.filter((item) => itemMatchesZone(item, selectedItemZone)),
    [items, selectedItemZone],
  );
  const npcCategories = useMemo(
    () =>
      [...new Set(
        npcs
          .filter(
            (npc) =>
              selectedNpcRegion === "all" || npc.region === selectedNpcRegion,
          )
          .map((npc) => npc.category),
      )],
    [npcs, selectedNpcRegion],
  );
  const sourceList = useMemo<CatalogEntry[]>(
    () =>
      section === "monsters"
        ? monsters.map((monster) => ({
            section: "monsters",
            name: monster.name,
            caption: `${formatNumber(monster.hp)} HP`,
            monster,
          }))
        : section === "items"
        ? visibleItems.map((item) => ({
            section: "items",
            name: item.name,
            caption: `${getItemSourceLabel(item.drops.length)}${item.zones?.length ? ` · ${item.zones.map((zone) => zone.toUpperCase()).join(" / ")}` : ""}`,
            item,
          }))
        : section === "bosses"
        ? bosses
            .filter(
              (boss) =>
                selectedBossRegion === "all" ||
                boss.region === selectedBossRegion,
            )
            .map((boss) => ({
              section: "bosses",
              name: boss.name,
              caption: getBossRegionLabel(boss.region),
              boss,
            }))
        : section === "npcs"
        ? npcs
            .filter(
              (npc) =>
                (selectedNpcRegion === "all" ||
                  npc.region === selectedNpcRegion) &&
                (selectedNpcCategory === "all" ||
                  npc.category === selectedNpcCategory),
            )
            .map((npc) => ({
              section: "npcs",
              name: npc.name,
              caption: npc.category,
              npc,
            }))
        : [],
    [items, visibleItems, npcs, section, selectedBossRegion, selectedNpcRegion, selectedNpcCategory],
  );
  const filteredList = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pl");
    const matches = normalizedQuery
      ? sourceList.filter((entry) =>
          entry.name.toLocaleLowerCase("pl").includes(normalizedQuery) ||
          (entry.section === "items" &&
            entry.item.alternativeNames?.some((name) =>
              name.toLocaleLowerCase("pl").includes(normalizedQuery),
            )),
        )
      : sourceList;
    return sortByName(matches);
  }, [query, sourceList]);
  const pageCount = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const visibleEntries = filteredList.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  useEffect(() => {
    if (skipNextPageReset.current) {
      skipNextPageReset.current = false;
      return;
    }

    setPage(1);
  }, [section, query, selectedBossRegion, selectedItemZone, selectedNpcRegion, selectedNpcCategory]);

  useEffect(() => {
    if (section === "monsters") {
      const currentSelectionVisible = filteredList.some(
        (entry) =>
          entry.section === "monsters" &&
          entry.monster.id === selectedMonster.id,
      );
      const firstMonster = filteredList[0];
      if (
        !currentSelectionVisible &&
        firstMonster?.section === "monsters"
      ) {
        setSelectedMonster(firstMonster.monster);
      }
    } else if (section === "items") {
      const currentSelectionVisible = filteredList.some(
        (entry) =>
          entry.section === "items" && entry.item.name === selectedItem?.name,
      );
      const firstItem = filteredList[0];
      if (
        !currentSelectionVisible &&
        firstItem?.section === "items"
      ) {
        setSelectedItemName(firstItem.item.name.toLocaleLowerCase("pl"));
      }
    } else if (section === "bosses") {
      const currentSelectionVisible = filteredList.some(
        (entry) =>
          entry.section === "bosses" &&
          (selectedBossRegion === "all" ||
            entry.boss.region === selectedBossRegion) &&
          entry.boss.name === selectedBoss.name,
      );
      const firstBoss = filteredList[0];
      if (
        !currentSelectionVisible &&
        firstBoss?.section === "bosses"
      ) {
        setSelectedBoss(firstBoss.boss);
      }
    } else if (section === "npcs") {
      const currentSelectionVisible = filteredList.some(
        (entry) =>
          entry.section === "npcs" && entry.npc.id === selectedNpc?.id,
      );
      const firstNpc = filteredList[0];
      if (
        !currentSelectionVisible &&
        firstNpc?.section === "npcs"
      ) {
        setSelectedNpc(firstNpc.npc);
      }
    }
  }, [
    filteredList,
    section,
    selectedItem?.name,
    selectedMonster.id,
    selectedBoss.name,
    selectedBossRegion,
    selectedNpc?.id,
  ]);

  function openSection(nextSection: Section) {
    const navigationOverrides: Partial<AppNavigationEntry> = {
      section: nextSection,
      query: "",
      page: 1,
      mapNpcRequest: undefined,
      mapMonsterRequest: undefined,
    };
    if (nextSection === "monsters") {
      navigationOverrides.selectedMonsterId = sortByName(monsters)[0]?.id;
    } else if (nextSection === "items") {
      navigationOverrides.selectedItemName = visibleItems[0]?.name
        .toLocaleLowerCase("pl") ?? "";
    } else if (nextSection === "bosses") {
      const firstBoss = sortByName(
        bosses.filter(
          (boss) =>
            selectedBossRegion === "all" ||
            boss.region === selectedBossRegion,
        ),
      )[0];
      if (firstBoss) {
        navigationOverrides.selectedBossName = firstBoss.name;
        navigationOverrides.selectedBossRegion = firstBoss.region;
      }
    } else if (nextSection === "npcs") {
      const firstNpc = sortByName(
        npcs.filter(
          (npc) =>
            (selectedNpcRegion === "all" ||
              npc.region === selectedNpcRegion) &&
            (selectedNpcCategory === "all" ||
              npc.category === selectedNpcCategory),
        ),
      )[0];
      if (firstNpc) navigationOverrides.selectedNpcId = firstNpc.id;
    } else if (nextSection === "systems") {
      navigationOverrides.selectedSystemName =
        sortByName(systems)[0]?.name ?? "";
    }
    pushNavigationEntry(navigationOverrides);

    setMapNpcRequest(undefined);
    setMapMonsterRequest(undefined);
    if (nextSection === "monsters") {
      setSelectedMonster(sortByName(monsters)[0]);
    } else if (nextSection === "items") {
      const firstItem = visibleItems[0];
      if (firstItem) {
        setSelectedItemName(firstItem.name.toLocaleLowerCase("pl"));
      }
    } else if (nextSection === "bosses") {
      const firstBoss = sortByName(
        bosses.filter(
          (boss) =>
            selectedBossRegion === "all" ||
            boss.region === selectedBossRegion,
        ),
      )[0];
      if (firstBoss) setSelectedBoss(firstBoss);
    } else if (nextSection === "npcs") {
      const firstNpc = sortByName(
        npcs.filter(
          (npc) =>
            (selectedNpcRegion === "all" ||
              npc.region === selectedNpcRegion) &&
            (selectedNpcCategory === "all" ||
              npc.category === selectedNpcCategory),
        ),
      )[0];
      if (firstNpc) setSelectedNpc(firstNpc);
    } else if (nextSection === "systems") {
      setSelectedSystemName(sortByName(systems)[0]?.name ?? "");
    }

    setSection(nextSection);
    setQuery("");
  }

  function showNpcOnMap(npc: NPC, position: MapNpcLocation) {
    pushNavigationEntry({
      section: "map",
      query: "",
      page: 1,
      mapNpcRequest: { npcId: npc.id, position },
      mapMonsterRequest: undefined,
    });
    setMapMonsterRequest(undefined);
    setMapPointRequest(undefined);
    setMapNpcRequest({ npcId: npc.id, position });
    setSection("map");
    setQuery("");
  }

  function showMonsterOnMap(monster: Monster) {
    pushNavigationEntry({
      section: "map",
      query: "",
      page: 1,
      mapNpcRequest: undefined,
      mapMonsterRequest: { monsterId: monster.id },
    });
    setMapNpcRequest(undefined);
    setMapPointRequest(undefined);
    setMapMonsterRequest({ monsterId: monster.id });
    setSection("map");
    setQuery("");
  }

  function showMonsterPositionOnMap(request: MapMonsterMapRequest) {
    pushNavigationEntry({
      section: "map",
      query: "",
      page: 1,
      mapNpcRequest: undefined,
      mapMonsterRequest: request,
    });
    setMapNpcRequest(undefined);
    setMapPointRequest(undefined);
    setMapMonsterRequest(request);
    setSection("map");
    setQuery("");
  }

  function showTeleportOnMap(day: number) {
    const teleport = dailyTeleports.positions.find(
      (position) => position.day === day,
    );
    if (!teleport) return;

    pushNavigationEntry({
      section: "map",
      query: "",
      page: 1,
      mapNpcRequest: undefined,
      mapMonsterRequest: undefined,
    });
    setMapNpcRequest(undefined);
    setMapMonsterRequest(undefined);
    setMapPointRequest({ kind: "teleport", day });
    setSection("map");
    setQuery("");
  }

  function openMonster(monster: Monster) {
    const sortedMonsters = sortByName(monsters);
    const monsterIndex = sortedMonsters.findIndex(
      (entry) => entry.id === monster.id,
    );

    skipNextPageReset.current = monsterIndex >= 0;
    const targetPage = Math.max(1, Math.floor(monsterIndex / pageSize) + 1);
    pushNavigationEntry({
      section: "monsters",
      query: "",
      page: targetPage,
      selectedMonsterId: monster.id,
      mapNpcRequest: undefined,
      mapMonsterRequest: undefined,
    });
    setPage(targetPage);
    setSelectedMonster(monster);
    setSection("monsters");
    setQuery("");
  }

  function openItem(name: string) {
    const normalizedName = name.toLocaleLowerCase("pl");
    const item = items.find(
      (candidate) =>
        candidate.name.toLocaleLowerCase("pl") === normalizedName ||
        candidate.alternativeNames?.some(
          (alternativeName) =>
            alternativeName.toLocaleLowerCase("pl") === normalizedName,
        ),
    );
    if (!item) return;
    const canonicalName = item.name.toLocaleLowerCase("pl");
    const targetZone =
      item.zones?.length &&
      selectedItemZone !== "all" &&
      !item.zones.includes(selectedItemZone)
        ? item.zones[0]
        : selectedItemZone;
    const itemIndex = items
      .filter((candidate) => itemMatchesZone(candidate, targetZone))
      .findIndex(
        (candidate) =>
          candidate.name.toLocaleLowerCase("pl") === canonicalName,
      );

    skipNextPageReset.current = itemIndex >= 0;
    const targetPage = Math.max(1, Math.floor(itemIndex / pageSize) + 1);
    pushNavigationEntry({
      section: "items",
      query: "",
      page: targetPage,
      selectedItemName: canonicalName,
      selectedItemZone: targetZone,
      mapNpcRequest: undefined,
      mapMonsterRequest: undefined,
    });
    setPage(targetPage);
    if (targetZone !== selectedItemZone) setSelectedItemZone(targetZone);
    setSelectedItemName(canonicalName);
    setSection("items");
    setQuery("");
  }

  const selectedBossLootMonster =
    selectedBoss.lootMonsterId !== undefined
      ? monsters.find((monster) => monster.id === selectedBoss.lootMonsterId)
      : monsters.find(
          (monster) =>
            monster.name.toLocaleLowerCase("pl") ===
              selectedBoss.name.toLocaleLowerCase("pl") &&
            monster.loot.length > 0,
        );
  const filteredInformation = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pl");
    if (!normalizedQuery) return informationCategories;

    return informationCategories.filter((category) =>
      JSON.stringify(category).toLocaleLowerCase("pl").includes(normalizedQuery),
    );
  }, [query]);
  const selectedInformation =
    filteredInformation.find((category) => category.name === selectedInformationName) ??
    filteredInformation[0];
  const filteredSystems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pl");
    const matchingSystems = normalizedQuery
      ? systems.filter((system) =>
          `${system.name} ${system.category} ${system.desc} ${system.info.join(" ")}`
            .toLocaleLowerCase("pl")
            .includes(normalizedQuery),
        )
      : systems;
    return sortByName(matchingSystems);
  }, [query]);
  const selectedSystem =
    filteredSystems.find((system) => system.name === selectedSystemName) ??
    filteredSystems[0];
  const shouldBuildGlobalSearchIndex =
    section === "search" && query.trim().length > 0;
  const globalSearchIndex = useMemo<GlobalSearchResult[]>(() => {
    if (!shouldBuildGlobalSearchIndex) return [];

    const makeResult = (
      kind: GlobalSearchResult["kind"],
      id: string,
      name: string,
      summary: string,
      data: unknown,
    ): GlobalSearchResult => ({
      id,
      kind,
      name,
      summary,
      searchText: normalizeSearchText(JSON.stringify(data) ?? ""),
    });

    return [
      ...monsters.map((monster) => {
        const mapCategories = monsterMapCategories.filter((category) =>
          category.monsterIds.includes(monster.id),
        );
        const mapNames = mapCategories.map((category) => category.name);
        const lootSummary = monster.loot.map((loot) => loot.name).join(", ");
        return makeResult(
          "monster",
          `monster-${monster.id}`,
          monster.name,
          `${formatNumber(monster.hp)} HP · ${formatNumber(monster.exp)} EXP · Łup: ${lootSummary || "brak danych"}`,
          { monster, mapNames },
        );
      }),
      ...items.map((item) => {
        const sources = item.drops.map(({ monster, loot }) => ({
          name: monster.name,
          loot: loot.name,
          frequency: loot.frequency,
        }));
        const sourceNames = [...new Set(sources.map((source) => source.name))];
        const shownSources = sourceNames.slice(0, 5).join(", ");
        const remainingSources = sourceNames.length - 5;
        const sourceSummary = sourceNames.length
          ? `Źródła: ${shownSources}${remainingSources > 0 ? ` i ${remainingSources} innych` : ""}`
          : "Brak znanych źródeł łupu";
        const itemSummary = [
          item.categories?.join(", "),
          item.alternativeNames?.length
            ? `Alternatywne nazwy: ${item.alternativeNames.join(", ")}`
            : undefined,
          item.zones?.map((zone) => zone.toUpperCase()).join(" / "),
          sourceSummary,
        ].filter(Boolean).join(" · ");
        return makeResult(
          "item",
          `item-${item.name.toLocaleLowerCase("pl")}`,
          item.name,
          itemSummary,
          { item: { ...item, drops: undefined }, sources },
        );
      }),
      ...bosses.map((boss) => {
        const lootMonster =
          boss.lootMonsterId !== undefined
            ? monsters.find((monster) => monster.id === boss.lootMonsterId)
            : undefined;
        return makeResult(
          "boss",
          `boss-${boss.region}-${boss.name}`,
          boss.name,
          `${getBossRegionLabel(boss.region)} · ${boss.description}`,
          { boss, lootMonster },
        );
      }),
      ...allNpcs.map((npc) =>
        makeResult(
          "npc",
          `npc-${npc.id}`,
          npc.name,
          `${npc.location} · ${npc.region} · ${npc.category} · ${npc.description}`,
          npc,
        ),
      ),
      ...monsterMapCategories.map((category) => {
        const linkedMonsters = category.monsterIds
          .map((id) => monsters.find((monster) => monster.id === id)?.name)
          .filter((name): name is string => Boolean(name));
        const firstPosition = category.positions[0];
        const positionSummary = firstPosition
          ? ` · poziom ${firstPosition[0]}, ${firstPosition[1]} × ${firstPosition[2]}`
          : "";
        return makeResult(
          "monster-location",
          `monster-location-${category.id}`,
          category.name,
          `${category.positions.length} pozycji${positionSummary}${linkedMonsters.length ? ` · ${linkedMonsters.join(", ")}` : ""}`,
          { category, linkedMonsters },
        );
      }),
      ...locations.map((location) =>
        makeResult(
          "map-location",
          `map-location-${location.id}`,
          location.name,
          `${location.description || "Lokalizacja na mapie"} · poziom ${location.position.floor}, ${location.position.x} × ${location.position.y}`,
          location,
        ),
      ),
      ...houses.map((house) =>
        makeResult(
          "house",
          `house-${house.id}`,
          house.name,
          `${house.region} · poziom ${house.position.floor}, ${house.position.x} × ${house.position.y}`,
          house,
        ),
      ),
      ...informationCategories.map((category) =>
        makeResult(
          "information",
          `information-${category.name}`,
          category.name,
          `${category.kind} · ${category.entries?.length ?? category.commands?.length ?? category.links?.length ?? 0} pozycji`,
          category,
        ),
      ),
      ...systems.map((system) =>
        makeResult(
          "system",
          `system-${system.name}`,
          system.name,
          `${system.category} · ${system.desc}`,
          system,
        ),
      ),
      makeResult(
        "teleports",
        "teleports-daily",
        "Teleporty do Antycznego Miasta",
        `${dailyTeleports.positions.length} dziennych pozycji · poziom ${dailyTeleports.floor}`,
        dailyTeleports,
      ),
    ];
  }, [items, monsterMapCategories, shouldBuildGlobalSearchIndex]);
  const globalSearchResults = useMemo(() => {
    const queryTerms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
    if (queryTerms.length === 0) return [];

    return globalSearchIndex
      .filter((result) =>
        queryTerms.every((term) => result.searchText.includes(term)),
      )
      .sort((a, b) => {
        const getRank = (name: string) => {
          const normalizedName = normalizeSearchText(name);
          if (normalizedName === queryTerms.join(" ")) return 0;
          if (normalizedName.startsWith(queryTerms[0])) return 1;
          if (normalizedName.includes(queryTerms[0])) return 2;
          return 3;
        };
        return (
          getRank(a.name) - getRank(b.name) ||
          a.name.localeCompare(b.name, "pl", { sensitivity: "base" })
        );
      });
  }, [globalSearchIndex, query]);

  function getNavigationEntry(): AppNavigationEntry {
    return {
      version: 1,
      section,
      query,
      page,
      selectedMonsterId: selectedMonster.id,
      selectedItemName,
      selectedItemZone,
      selectedBossName: selectedBoss.name,
      selectedBossRegion: selectedBoss.region,
      selectedNpcId: selectedNpc?.id ?? null,
      selectedNpcRegion,
      selectedNpcCategory,
      selectedInformationName,
      selectedSystemName,
      mapNpcRequest,
      mapMonsterRequest,
    };
  }
  currentNavigationEntryRef.current = getNavigationEntry();

  function isNavigationEntry(value: unknown): value is AppNavigationEntry {
    if (typeof value !== "object" || value === null) return false;
    const entry = value as Partial<AppNavigationEntry>;
    return (
      entry.version === 1 &&
      [
        "search",
        "map",
        "monsters",
        "items",
        "bosses",
        "npcs",
        "info",
        "systems",
      ].includes(entry.section ?? "") &&
      typeof entry.query === "string" &&
      typeof entry.page === "number" &&
      typeof entry.selectedMonsterId === "number" &&
      typeof entry.selectedItemName === "string" &&
      ["all", "main", "rook"].includes(entry.selectedItemZone ?? "") &&
      typeof entry.selectedBossName === "string" &&
      typeof entry.selectedBossRegion === "string" &&
      (typeof entry.selectedNpcId === "number" || entry.selectedNpcId === null) &&
      typeof entry.selectedNpcRegion === "string" &&
      typeof entry.selectedNpcCategory === "string" &&
      typeof entry.selectedInformationName === "string" &&
      typeof entry.selectedSystemName === "string" &&
      isValidMonsterMapRequest(entry.mapMonsterRequest)
    );
  }

  function getAppNavigationEntry(state: unknown) {
    if (typeof state !== "object" || state === null) return undefined;
    const entry = (state as Record<string, unknown>)[appNavigationStateKey];
    return isNavigationEntry(entry) ? entry : undefined;
  }

  function updateCurrentHistoryEntry(entry = getNavigationEntry()) {
    const currentState =
      typeof window.history.state === "object" && window.history.state !== null
        ? window.history.state
        : {};
    window.history.replaceState(
      { ...currentState, [appNavigationStateKey]: entry },
      "",
      getNavigationUrl(entry),
    );
  }

  function pushNavigationEntry(overrides: Partial<AppNavigationEntry> = {}) {
    const currentEntry = getNavigationEntry();
    const nextEntry = { ...currentEntry, ...overrides, version: 1 as const };
    if (JSON.stringify(currentEntry) === JSON.stringify(nextEntry)) return;

    updateCurrentHistoryEntry(currentEntry);
    const currentState =
      typeof window.history.state === "object" && window.history.state !== null
        ? window.history.state
        : {};
    window.history.pushState(
      { ...currentState, [appNavigationStateKey]: nextEntry },
      "",
      getNavigationUrl(nextEntry),
    );
  }

  function restoreNavigationEntry(entry: AppNavigationEntry) {
    const currentEntry = currentNavigationEntryRef.current ?? entry;
    const resetDependenciesChanged =
      entry.section !== currentEntry.section ||
      entry.query !== currentEntry.query ||
      entry.selectedBossRegion !== currentEntry.selectedBossRegion ||
      entry.selectedItemZone !== currentEntry.selectedItemZone ||
      entry.selectedNpcRegion !== currentEntry.selectedNpcRegion ||
      entry.selectedNpcCategory !== currentEntry.selectedNpcCategory;
    skipNextPageReset.current = resetDependenciesChanged;
    setSection(entry.section);
    setQuery(entry.query);
    setPage(entry.page);
    setSelectedMonster(
      monsters.find((monster) => monster.id === entry.selectedMonsterId) ??
        sortByName(monsters)[0],
    );
    setSelectedItemName(entry.selectedItemName);
    setSelectedItemZone(entry.selectedItemZone);
    setSelectedBoss(
      bosses.find(
        (boss) =>
          boss.name === entry.selectedBossName &&
          boss.region === entry.selectedBossRegion,
      ) ?? sortByName(bosses)[0],
    );
    setSelectedBossRegion(entry.selectedBossRegion);
    setSelectedNpc(
      entry.selectedNpcId === null
        ? undefined
        : npcs.find((npc) => npc.id === entry.selectedNpcId),
    );
    setSelectedNpcRegion(entry.selectedNpcRegion);
    setSelectedNpcCategory(entry.selectedNpcCategory);
    setSelectedInformationName(entry.selectedInformationName);
    setSelectedSystemName(entry.selectedSystemName);
    setMapNpcRequest(entry.mapNpcRequest);
    setMapMonsterRequest(entry.mapMonsterRequest);
  }

  function selectCatalogEntry(entry: CatalogEntry) {
    if (entry.section === "monsters") {
      pushNavigationEntry({
        section: "monsters",
        selectedMonsterId: entry.monster.id,
      });
      setSelectedMonster(entry.monster);
    } else if (entry.section === "items") {
      const name = entry.item.name.toLocaleLowerCase("pl");
      pushNavigationEntry({ section: "items", selectedItemName: name });
      setSelectedItemName(name);
    } else if (entry.section === "bosses") {
      pushNavigationEntry({
        section: "bosses",
        selectedBossName: entry.boss.name,
        selectedBossRegion: entry.boss.region,
      });
      setSelectedBoss(entry.boss);
    } else {
      pushNavigationEntry({ section: "npcs", selectedNpcId: entry.npc.id });
      setSelectedNpc(entry.npc);
    }
  }

  function selectInformation(name: string) {
    pushNavigationEntry({ section: "info", selectedInformationName: name });
    setSelectedInformationName(name);
  }

  function openInformation(name: string) {
    const category = informationCategories.find((entry) => entry.name === name);
    if (!category) return;
    pushNavigationEntry({
      section: "info",
      query: "",
      page: 1,
      selectedInformationName: category.name,
      mapNpcRequest: undefined,
      mapMonsterRequest: undefined,
    });
    setMapNpcRequest(undefined);
    setMapMonsterRequest(undefined);
    setMapPointRequest(undefined);
    setSelectedInformationName(category.name);
    setSection("info");
    setQuery("");
  }

  function selectSystem(name: string) {
    pushNavigationEntry({ section: "systems", selectedSystemName: name });
    setSelectedSystemName(name);
  }

  function selectGlobalSearchResult(result: GlobalSearchResult) {
    if (result.kind === "monster") {
      const monster = monsters.find(
        (entry) => `monster-${entry.id}` === result.id,
      );
      if (monster) openMonster(monster);
    } else if (result.kind === "item") {
      openItem(result.name);
    } else if (result.kind === "boss") {
      const boss = bosses.find(
        (entry) => `boss-${entry.region}-${entry.name}` === result.id,
      );
      if (!boss) return;
      pushNavigationEntry({
        section: "bosses",
        query: "",
        page: 1,
        selectedBossName: boss.name,
        selectedBossRegion: boss.region,
        mapNpcRequest: undefined,
        mapMonsterRequest: undefined,
      });
      setSelectedBoss(boss);
      setSection("bosses");
      setQuery("");
    } else if (result.kind === "npc") {
      const npc = allNpcs.find((entry) => `npc-${entry.id}` === result.id);
      if (!npc) return;
      const position = npc.mapPositions?.[0];
      if (npc.mapOnly) {
        if (position) showNpcOnMap(npc, position);
        else openSection("map");
        return;
      }
      pushNavigationEntry({
        section: "npcs",
        query: "",
        page: 1,
        selectedNpcId: npc.id,
        selectedNpcRegion: "all",
        selectedNpcCategory: "all",
        mapNpcRequest: undefined,
        mapMonsterRequest: undefined,
      });
      setSelectedNpc(npc);
      setSelectedNpcRegion("all");
      setSelectedNpcCategory("all");
      setMapNpcRequest(undefined);
      setMapMonsterRequest(undefined);
      setSection("npcs");
      setQuery("");
    } else if (result.kind === "monster-location") {
      const category = monsterMapCategories.find(
        (entry) => `monster-location-${entry.id}` === result.id,
      );
      if (!category) return;
      const [floor, x, y] = category.positions[0] ?? [];
      if (floor !== undefined && x !== undefined && y !== undefined) {
        showMonsterPositionOnMap({
          monsterId: category.monsterIds[0],
          marker: {
            categoryId: category.id,
            positionIndex: 0,
            floor,
            x,
            y,
          },
        });
      } else {
        openSection("map");
      }
    } else if (result.kind === "map-location") {
      const locationId = Number(result.id.replace("map-location-", ""));
      setMapPointRequest(
        Number.isInteger(locationId)
          ? { kind: "location", id: locationId }
          : undefined,
      );
      openSection("map");
    } else if (result.kind === "house") {
      const houseId = Number(result.id.replace("house-", ""));
      setMapPointRequest(
        Number.isInteger(houseId) ? { kind: "house", id: houseId } : undefined,
      );
      openSection("map");
    } else if (result.kind === "information" || result.kind === "teleports") {
      const category =
        result.kind === "teleports"
          ? informationCategories.find((entry) => entry.kind === "teleports")
          : informationCategories.find((entry) => entry.name === result.name);
      if (!category) return;
      pushNavigationEntry({
        section: "info",
        query: "",
        page: 1,
        selectedInformationName: category.name,
        mapNpcRequest: undefined,
        mapMonsterRequest: undefined,
      });
      setSelectedInformationName(category.name);
      setSection("info");
      setQuery("");
    } else if (result.kind === "system") {
      pushNavigationEntry({
        section: "systems",
        query: "",
        page: 1,
        selectedSystemName: result.name,
        mapNpcRequest: undefined,
        mapMonsterRequest: undefined,
      });
      setSelectedSystemName(result.name);
      setSection("systems");
      setQuery("");
    }
  }

  function navigateToPage(nextPage: number) {
    const boundedPage = Math.max(1, Math.min(pageCount, nextPage));
    if (boundedPage === page) return;
    pushNavigationEntry({ page: boundedPage });
    setPage(boundedPage);
  }

  useEffect(() => {
    updateCurrentHistoryEntry();

    function handlePopState(event: PopStateEvent) {
      const entry = getAppNavigationEntry(event.state);
      if (entry) restoreNavigationEntry(entry);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    updateCurrentHistoryEntry();
  }, [
    section,
    query,
    page,
    selectedMonster,
    selectedItemName,
    selectedItemZone,
    selectedBoss,
    selectedBossRegion,
    selectedNpc,
    selectedNpcRegion,
    selectedNpcCategory,
    selectedInformationName,
    selectedSystemName,
    mapNpcRequest,
    mapMonsterRequest,
  ]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="ApoWiki — strona główna">
          <span className="brand-mark">A</span>
          <span>
            <strong>ApoWiki</strong>
            <small>ENCYKLOPEDIA SERWERA</small>
          </span>
        </a>
        <div className="server-status">
          <span className="status-dot" />
          <span>BAZA WIEDZY</span>
        </div>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">Wszystko o świecie Apo</p>
          <h1>Odkrywaj. Poluj. Zbieraj.</h1>
          <p className="intro-copy">
            Przeglądaj mapę świata, bestiariusz, przedmioty i postacie NPC.
          </p>
        </div>
        <div className="intro-stats" aria-label="Zawartość bazy">
          <span><strong>{monsters.length}</strong> potworów</span>
          <span><strong>{items.length}</strong> przedmiotów</span>
          <span><strong>{bosses.length}</strong> bossów</span>
          <span><strong>{npcs.length}</strong> NPC</span>
        </div>
      </section>

      <nav className="section-tabs" aria-label="Kategorie">
        <button
          className={section === "search" ? "tab active" : "tab"}
          onClick={() => openSection("search")}
          type="button"
        >
          <span className="tab-icon">⌕</span> Szukaj
        </button>
        <button
          className={section === "map" ? "tab active" : "tab"}
          onClick={() => openSection("map")}
          type="button"
        >
          <span className="tab-icon">⌖</span> Mapa
        </button>
        <button
          className={section === "monsters" ? "tab active" : "tab"}
          onClick={() => openSection("monsters")}
          type="button"
        >
          <span className="tab-icon">♟</span> Potwory
          <span className="tab-count">{monsters.length}</span>
        </button>
        <button
          className={section === "items" ? "tab active" : "tab"}
          onClick={() => openSection("items")}
          type="button"
        >
          <span className="tab-icon">◆</span> Przedmioty
          <span className="tab-count">{items.length}</span>
        </button>
        <button
          className={section === "bosses" ? "tab active" : "tab"}
          onClick={() => openSection("bosses")}
          type="button"
        >
          <span className="tab-icon">☠</span> Bossy
          <span className="tab-count">{bosses.length}</span>
        </button>
        <button
          className={section === "npcs" ? "tab active" : "tab"}
          onClick={() => openSection("npcs")}
          type="button"
        >
          <span className="tab-icon">♙</span> NPC
          <span className="tab-count">{npcs.length}</span>
        </button>
        <button
          className={section === "info" ? "tab active" : "tab"}
          onClick={() => openSection("info")}
          type="button"
        >
          <span className="tab-icon">ⓘ</span> Informacje
          <span className="tab-count">{informationCategories.length}</span>
        </button>
        <button
          className={section === "systems" ? "tab active" : "tab"}
          onClick={() => openSection("systems")}
          type="button"
        >
          <span className="tab-icon">⚙</span> Systemy
          <span className="tab-count">{systems.length}</span>
        </button>
      </nav>

      <Suspense
        fallback={
          <p className="global-search-status" role="status">
            Ładowanie sekcji...
          </p>
        }
      >
      {section === "search" ? (
        <GlobalSearchWorkspace
          loading={monsterMapLoadStatus === "loading"}
          onQueryChange={setQuery}
          onRetry={loadMonsterMapData}
          onSelect={selectGlobalSearchResult}
          query={query}
          results={globalSearchResults}
          searchError={monsterMapLoadError}
        />
      ) : section === "map" ? (
        <MapWorkspace
          houses={houses}
          locations={locations}
          mapMonsterSearchNames={mapMonsterSearchNames}
          monsterMapCategories={monsterMapCategories}
          monsterMapLoadError={monsterMapLoadError}
          monsterMapLoadStatus={monsterMapLoadStatus}
          monsterMapRequest={mapMonsterRequest}
          mapPointRequest={mapPointRequest}
          monsters={monsters}
          onLoadMonsterLocations={loadMonsterMapData}
          onMapPointRequestHandled={() => setMapPointRequest(undefined)}
          onSelectMonsterPosition={showMonsterPositionOnMap}
          npcMapRequest={mapNpcRequest}
          npcs={allNpcs}
          positions={mapNpcPositions}
        />
      ) : section === "info" ? (
        <InformationWorkspace
          categories={filteredInformation}
          onQueryChange={setQuery}
          onSelect={selectInformation}
          query={query}
          selectedCategory={selectedInformation}
          details={
            selectedInformation ? (
              <InformationDetails
                category={selectedInformation}
                key={selectedInformation.name}
                monsters={monsters}
                onOpenItem={openItem}
                onShowTeleportOnMap={showTeleportOnMap}
              />
            ) : undefined
          }
        />
      ) : section === "systems" ? (
        <SystemsWorkspace
          onQueryChange={setQuery}
          onSelect={selectSystem}
          query={query}
          selectedSystem={selectedSystem}
          systems={filteredSystems}
        />
      ) : (
      <CatalogWorkspace
        section={section}
        bossRegions={bossRegions}
        selectedBossRegion={selectedBossRegion}
        setSelectedBossRegion={setSelectedBossRegion}
        query={query}
        setQuery={setQuery}
        selectedItemZone={selectedItemZone}
        setSelectedItemZone={setSelectedItemZone}
        selectedNpcRegion={selectedNpcRegion}
        setSelectedNpcRegion={setSelectedNpcRegion}
        selectedNpcCategory={selectedNpcCategory}
        setSelectedNpcCategory={setSelectedNpcCategory}
        npcCategories={npcCategories}
        filteredList={filteredList}
        visibleEntries={visibleEntries}
        selectedMonster={selectedMonster}
        selectedItem={selectedItem}
        selectedBoss={selectedBoss}
        selectedNpc={selectedNpc}
        selectCatalogEntry={selectCatalogEntry}
        page={page}
        pageCount={pageCount}
        navigateToPage={navigateToPage}
        monsterMapPositionCounts={monsterMapPositionCounts}
        showMonsterOnMap={showMonsterOnMap}
        openItem={openItem}
        openMonster={openMonster}
        showNpcOnMap={showNpcOnMap}
        openInformation={openInformation}
        selectedBossLootMonster={selectedBossLootMonster}
      />
      )}
      </Suspense>

      <footer className="footer">
        <span>ApoWiki <span className="footer-divider">/</span> Wiedza o serwerze w jednym miejscu</span>
        <span>Dane gry <span className="footer-dot">•</span> Bestiariusz</span>
      </footer>
    </main>
  );
}

export default App;
