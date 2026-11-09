import { useEffect, useMemo, useRef, useState } from "react";
import bossData from "./data/bosses.json";
import informationData from "./data/information.json";
import itemCatalogData from "./data/items.json";
import systemData from "./data/systems.json";
import type { Item, ItemZone, Monster } from "./types";
import MapWorkspace from "./map/MapWorkspace";
import { InformationWorkspace } from "./information/InformationWorkspace";
import type { InformationCategory } from "./information/types";
import { SystemsWorkspace } from "./systems/SystemsWorkspace";
import type { GameSystem } from "./systems/types";
import CatalogWorkspace from "./catalog/CatalogWorkspace";
import { InformationDetails } from "./catalog/Details";
import type { Boss, BossRegionData, CatalogEntry } from "./catalog/types";
import {
  formatNumber,
  getBossRegionLabel,
  itemMatchesZone,
} from "./catalog/utils";
import {
  allNpcs,
  houses,
  locations,
  mapDimensions,
  mapNpcPositions,
  monsters,
  npcs,
} from "./map/mapData";
import type {
  MapMonsterMapRequest,
  MapNpcLocation,
  MapNpcMapRequest,
  MonsterMapCategory,
  NPC,
} from "./map/mapData";

const systems: GameSystem[] = systemData;
const informationCategories: InformationCategory[] = informationData;
type ItemCatalogRecord = Omit<Item, "drops">;
const itemCatalog: ItemCatalogRecord[] = itemCatalogData.map((item) => ({
  ...item,
  zones: item.zones.filter(
    (zone): zone is ItemZone => zone === "main" || zone === "rook",
  ),
}));

const bossRegions: BossRegionData[] = bossData;
const bosses: Boss[] = bossRegions.flatMap((region) =>
  region.bosses.map((boss) => ({ ...boss, region: region.name })),
);

const pageSize = 10;

type Section =
  | "map"
  | "monsters"
  | "items"
  | "bosses"
  | "npcs"
  | "info"
  | "systems";
type ZoneFilter = "all" | ItemZone;
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
function readNavigationFromUrl(): AppNavigationEntry {
  const params = new URL(window.location.href).searchParams;
  const sectionParam = params.get("view");
  const sections: Section[] = [
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
    : "map";
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













function getItemSourceLabel(count: number) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;
  if (count === 1) return "1 źródło";
  if (lastTwoDigits < 12 || lastTwoDigits > 14) {
    if (lastDigit >= 2 && lastDigit <= 4) return `${count} źródła`;
  }
  return `${count} źródeł`;
}







function App() {
  const [initialNavigation] = useState(readNavigationFromUrl);
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
    void import("./data/monsterLocations.json")
      .then(({ default: data }) => {
        setMonsterMapCategories(
          data.map((category) => ({
            ...category,
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
    if (section === "monsters" || mapMonsterRequest) loadMonsterMapData();
  }, [section, mapMonsterRequest]);

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
        const item = itemMap.get(key);

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
      .find((item) => item.name.toLocaleLowerCase("pl") === selectedItemName) ??
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
          entry.name.toLocaleLowerCase("pl").includes(normalizedQuery),
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
    setMapMonsterRequest(request);
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
      (candidate) => candidate.name.toLocaleLowerCase("pl") === normalizedName,
    );
    if (!item) return;
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
          candidate.name.toLocaleLowerCase("pl") === normalizedName,
      );

    skipNextPageReset.current = itemIndex >= 0;
    const targetPage = Math.max(1, Math.floor(itemIndex / pageSize) + 1);
    pushNavigationEntry({
      section: "items",
      query: "",
      page: targetPage,
      selectedItemName: normalizedName,
      selectedItemZone: targetZone,
      mapNpcRequest: undefined,
      mapMonsterRequest: undefined,
    });
    setPage(targetPage);
    if (targetZone !== selectedItemZone) setSelectedItemZone(targetZone);
    setSelectedItemName(normalizedName);
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
      ["map", "monsters", "items", "bosses", "npcs", "info", "systems"].includes(
        entry.section ?? "",
      ) &&
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

  function selectSystem(name: string) {
    pushNavigationEntry({ section: "systems", selectedSystemName: name });
    setSelectedSystemName(name);
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

      {section === "map" ? (
        <MapWorkspace
          houses={houses}
          locations={locations}
          mapMonsterSearchNames={mapMonsterSearchNames}
          monsterMapCategories={monsterMapCategories}
          monsterMapLoadError={monsterMapLoadError}
          monsterMapLoadStatus={monsterMapLoadStatus}
          monsterMapRequest={mapMonsterRequest}
          onLoadMonsterLocations={loadMonsterMapData}
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
                onOpenItem={openItem}
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
        selectedBossLootMonster={selectedBossLootMonster}
      />
      )}

      <footer className="footer">
        <span>ApoWiki <span className="footer-divider">/</span> Wiedza o serwerze w jednym miejscu</span>
        <span>Dane gry <span className="footer-dot">•</span> Bestiariusz</span>
      </footer>
    </main>
  );
}

export default App;
