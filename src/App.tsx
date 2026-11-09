import { useEffect, useMemo, useRef, useState } from "react";
import bossData from "./data/bosses.json";
import graphics from "./data/graphics.json";
import houseData from "./data/houses.json";
import informationData from "./data/information.json";
import itemCatalogData from "./data/items.json";
import locationData from "./data/locations.json";
import monsterData from "./data/monsters.json";
import npcData from "./data/npcs.json";
import systemData from "./data/systems.json";
import type { Item, ItemZone, Monster } from "./types";

const monsters: Monster[] = monsterData;
type MapNpcLocation = {
  floor: number;
  x: number;
  y: number;
};
type MapHouse = {
  id: number;
  name: string;
  region: string;
  position: MapNpcLocation;
};
type MapLocation = {
  id: number;
  name: string;
  description: string;
  position: MapNpcLocation;
};
type MapNpcMapRequest = {
  npcId: number;
  position: MapNpcLocation;
};
type MapMonsterMapRequest = {
  monsterId: number;
};
type MonsterMapTuple = readonly [number, number, number];
type MonsterMapCategory = {
  id: number;
  name: string;
  monsterIds: number[];
  positions: MonsterMapTuple[];
};
type MapMarkerLayer = "" | "npcs" | "monsters" | "houses" | "locations";
type NPC = {
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
const allNpcs: NPC[] = npcData;
const npcs = allNpcs.filter((npc) => !npc.mapOnly);
const houses: MapHouse[] = houseData;
const locations: MapLocation[] = locationData;
type GameSystem = {
  name: string;
  category: string;
  desc: string;
  info: string[];
};
const systems: GameSystem[] = systemData;
type CostumeInfo = {
  name: string;
  appearanceMonster: string;
  description?: string;
  items: { amount: string; name: string; note?: string }[];
  reward?: string;
};
type InformationCategory = {
  name: string;
  kind: string;
  stages?: string[][];
  gains?: string[][];
  trivia?: { name: string; clientId: number; subType: number; desc: string };
  professions?: Record<string, {
    name: string;
    spells: string[][];
    soul: string[][];
  }>;
  commands?: string[][];
  links?: { name: string; info: string; url: string }[];
  rules?: string[];
  entries?: CostumeInfo[];
};
const informationCategories: InformationCategory[] = informationData;
type ItemCatalogRecord = Omit<Item, "drops">;
const itemCatalog: ItemCatalogRecord[] = itemCatalogData.map((item) => ({
  ...item,
  zones: item.zones.filter(
    (zone): zone is ItemZone => zone === "main" || zone === "rook",
  ),
}));
type BossRegionData = {
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
type Boss = BossRegionData["bosses"][number] & { region: string };
const bossRegions: BossRegionData[] = bossData;
const bosses: Boss[] = bossRegions.flatMap((region) =>
  region.bosses.map((boss) => ({ ...boss, region: region.name })),
);
const graphicsByName: {
  monsters: Record<string, string>;
  monsterVariants: Record<number, string>;
  items: Record<string, string>;
} = graphics;
const pageSize = 10;
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

function compareLootFrequency(a: { frequency: string }, b: { frequency: string }) {
  return (
    (lootFrequencyOrder[a.frequency] ?? Number.MAX_SAFE_INTEGER) -
    (lootFrequencyOrder[b.frequency] ?? Number.MAX_SAFE_INTEGER)
  );
}

type Section =
  | "map"
  | "monsters"
  | "items"
  | "bosses"
  | "npcs"
  | "info"
  | "systems";
type ZoneFilter = "all" | ItemZone;
type MapNpcPosition = {
  npcId: number;
  floor: number;
  x: number;
  y: number;
};
function getMapPositionKey(position: MapNpcPosition) {
  return `${position.npcId}:${position.floor}:${position.x}:${position.y}`;
}
function getMapMonsterPositionKey(categoryId: number, positionIndex: number) {
  return `${categoryId}:${positionIndex}`;
}
function MapHouseIcon() {
  return (
    <svg aria-hidden="true" className="map-house-icon" viewBox="0 0 28 30">
      <path
        d="M1.5 13.2 14 2l12.5 11.2V28H1.5z"
        fill="#2584c4"
        stroke="#101a22"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M10.5 28v-9h7v9"
        fill="#d7e8f0"
        stroke="#101a22"
        strokeWidth="1.2"
      />
    </svg>
  );
}
function MapNpcIcon() {
  return (
    <svg aria-hidden="true" className="map-npc-icon" viewBox="0 0 28 32">
      <path
        d="M2 2h24v18L14 30 2 20z"
        fill="#39bd45"
        stroke="#101a22"
        strokeWidth="1.5"
      />
      <text
        dominantBaseline="middle"
        textAnchor="middle"
        x="14"
        y="11"
      >
        NPC
      </text>
    </svg>
  );
}
type CatalogEntry =
  | { section: "monsters"; name: string; caption: string; monster: Monster }
  | { section: "items"; name: string; caption: string; item: Item }
  | { section: "bosses"; name: string; caption: string; boss: Boss }
  | { section: "npcs"; name: string; caption: string; npc: NPC };

const mapNpcPositions: MapNpcPosition[] = [
  ...allNpcs.flatMap((npc) =>
    (npc.mapPositions ?? []).map((position) => ({
      npcId: npc.id,
      ...position,
    })),
  ),
];
const mapFloors = Array.from({ length: 16 }, (_, index) => 7 - index);
const mapDimensions = { width: 2112, height: 1536 };
const defaultMapZoom = 1;
const maxMapZoom = 16;

function formatNumber(value: number) {
  return new Intl.NumberFormat("pl-PL").format(value);
}

function formatLootAmount(amount: number) {
  return amount > 1 ? `1–${formatNumber(amount)}` : "1";
}

function sortByName<T extends { name: string }>(entries: T[]) {
  return [...entries].sort((a, b) =>
    a.name.localeCompare(b.name, "pl", { sensitivity: "base" }),
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getMonsterImage(monster: Pick<Monster, "id" | "name">) {
  return graphicsByName.monsterVariants[monster.id] ?? graphicsByName.monsters[monster.name];
}

function getBossImage(boss: Boss) {
  return graphicsByName.monsters[boss.name] ?? boss.image;
}

function getItemImage(name: string) {
  return graphicsByName.items[name.toLocaleLowerCase("pl")];
}

function getCatalogItemImage(item: Item) {
  return item.clientId
    ? `./images/items/${item.clientId}.png`
    : getItemImage(item.name);
}

function itemMatchesZone(item: Item, zone: ZoneFilter) {
  return zone === "all" || !item.zones?.length || item.zones.includes(zone);
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

function getItemCategoryLabel(category: string) {
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

function getBossRegionLabel(region: string) {
  return region === "OKOLICZNOSCIOWE" ? "Okolicznościowe" : region;
}

function Graphic({
  className,
  image,
  name,
}: {
  className: string;
  image?: string;
  name: string;
}) {
  return (
    <span aria-hidden="true" className={`game-graphic ${className}`}>
      {image && (
        <img
          alt=""
          key={image}
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
          src={image}
        />
      )}
      <span>{getInitials(name)}</span>
    </span>
  );
}

function App() {
  const [section, setSection] = useState<Section>("map");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedMonster, setSelectedMonster] = useState<Monster>(
    () => sortByName(monsters)[0],
  );
  const [selectedItemName, setSelectedItemName] = useState("");
  const [selectedItemZone, setSelectedItemZone] = useState<ZoneFilter>("all");
  const [selectedBossRegion, setSelectedBossRegion] = useState("all");
  const [selectedBoss, setSelectedBoss] = useState<Boss>(
    () => sortByName(bosses)[0],
  );
  const [selectedNpcRegion, setSelectedNpcRegion] = useState("all");
  const [selectedNpcCategory, setSelectedNpcCategory] = useState("all");
  const [selectedNpc, setSelectedNpc] = useState<NPC>();
  const [mapNpcRequest, setMapNpcRequest] = useState<MapNpcMapRequest>();
  const [mapMonsterRequest, setMapMonsterRequest] =
    useState<MapMonsterMapRequest>();
  const [monsterMapCategories, setMonsterMapCategories] = useState<
    MonsterMapCategory[]
  >([]);
  const [monsterMapLoadStatus, setMonsterMapLoadStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [monsterMapLoadError, setMonsterMapLoadError] = useState("");
  const [selectedInformationName, setSelectedInformationName] = useState(
    informationCategories[0].name,
  );
  const [selectedSystemName, setSelectedSystemName] = useState(systems[0]?.name ?? "");
  const skipNextPageReset = useRef(false);

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
    setMapMonsterRequest(undefined);
    setMapNpcRequest({ npcId: npc.id, position });
    setSection("map");
    setQuery("");
  }

  function showMonsterOnMap(monster: Monster) {
    setMapNpcRequest(undefined);
    setMapMonsterRequest({ monsterId: monster.id });
    setSection("map");
    setQuery("");
  }

  function openMonster(monster: Monster) {
    const sortedMonsters = sortByName(monsters);
    const monsterIndex = sortedMonsters.findIndex(
      (entry) => entry.id === monster.id,
    );

    skipNextPageReset.current = monsterIndex >= 0;
    setPage(Math.max(1, Math.floor(monsterIndex / pageSize) + 1));
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
    setPage(Math.max(1, Math.floor(itemIndex / pageSize) + 1));
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
          npcMapRequest={mapNpcRequest}
          npcs={allNpcs}
          positions={mapNpcPositions}
        />
      ) : section === "info" ? (
        <InformationWorkspace
          categories={filteredInformation}
          onOpenItem={openItem}
          onQueryChange={setQuery}
          onSelect={setSelectedInformationName}
          query={query}
          selectedCategory={selectedInformation}
        />
      ) : section === "systems" ? (
        <SystemsWorkspace
          onQueryChange={setQuery}
          onSelect={setSelectedSystemName}
          query={query}
          selectedSystem={selectedSystem}
          systems={filteredSystems}
        />
      ) : (
      <section className="workspace">
        <aside className="catalog">
          <div className="catalog-heading">
            <div>
              <p className="eyebrow">
                {section === "monsters" ? "BESTIARIUSZ" : section === "items" ? "KOLEKCJA" : section === "bosses" ? "UNIKALNE POTWORY" : "POSTACIE NIEZALEŻNE"}
              </p>
              <h2>{section === "monsters" ? "Potwory" : section === "items" ? "Przedmioty" : section === "bosses" ? "Bossy" : "NPC"}</h2>
            </div>
            <span className="result-count">{filteredList.length}</span>
          </div>
          {section === "bosses" && (
            <label className="boss-region-filter">
              <select
                aria-label="Wybierz krainę bossów"
                onChange={(event) => {
                  setSelectedBossRegion(event.target.value);
                  setQuery("");
                }}
                value={selectedBossRegion}
              >
                <option value="all">WSZYSTKIE</option>
                {bossRegions.map((region) => (
                  <option key={region.name} value={region.name}>
                    {getBossRegionLabel(region.name)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {section === "items" && (
            <label className="boss-region-filter">
              <select
                aria-label="Wybierz strefę przedmiotów"
                onChange={(event) => {
                  const zone = event.target.value;
                  setSelectedItemZone(
                    zone === "all" || zone === "rook" ? zone : "main",
                  );
                  setQuery("");
                }}
                value={selectedItemZone}
              >
                <option value="all">WSZYSTKIE</option>
                <option value="main">MAIN</option>
                <option value="rook">ROOK</option>
              </select>
            </label>
          )}
          {section === "npcs" && (
            <>
              <label className="boss-region-filter">
                <select
                  aria-label="Wybierz krainę NPC"
                  onChange={(event) => {
                    setSelectedNpcRegion(event.target.value);
                    setSelectedNpcCategory("all");
                    setQuery("");
                  }}
                  value={selectedNpcRegion}
                >
                  <option value="all">WSZYSTKIE</option>
                  <option value="MAIN">MAIN</option>
                  <option value="ROOK">ROOK</option>
                </select>
              </label>
              <label className="boss-region-filter">
                <select
                  aria-label="Wybierz kategorię NPC"
                  onChange={(event) => {
                    setSelectedNpcCategory(event.target.value);
                    setQuery("");
                  }}
                  value={selectedNpcCategory}
                >
                  <option value="all">Wszystkie kategorie</option>
                  {npcCategories.map((category) => (
                    <option key={category} value={category}>
                      {category.toLocaleUpperCase("pl")}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label={`Szukaj ${section === "monsters" ? "potwora" : section === "items" ? "przedmiotu" : section === "bosses" ? "bossa" : "NPC"}`}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Szukaj ${section === "monsters" ? "potwora" : section === "items" ? "przedmiotu" : section === "bosses" ? "bossa" : "NPC"}...`}
              type="search"
              value={query}
            />
            {query && (
              <button
                aria-label="Wyczyść wyszukiwanie"
                className="clear-search"
                onClick={() => setQuery("")}
                type="button"
              >
                ×
              </button>
            )}
          </label>

          <div className="entry-list" aria-live="polite">
            {visibleEntries.map((entry) => {
              const isSelected =
                entry.section === "monsters"
                  ? selectedMonster.id === entry.monster.id
                  : entry.section === "items"
                  ? selectedItem?.name === entry.name
                  : entry.section === "bosses"
                  ? selectedBoss.region === entry.boss.region &&
                    selectedBoss.name === entry.boss.name
                  : selectedNpc?.id === entry.npc.id;

              return (
                <button
                  aria-current={isSelected ? "true" : undefined}
                  className={isSelected ? "entry selected" : "entry"}
                  key={
                    entry.section === "monsters"
                      ? entry.monster.id
                      : entry.section === "items"
                      ? entry.name
                      : entry.section === "bosses"
                      ? `${entry.boss.region}-${entry.boss.name}`
                      : entry.npc.id
                  }
                  onClick={() =>
                    entry.section === "monsters"
                      ? setSelectedMonster(entry.monster)
                      : entry.section === "items"
                      ? setSelectedItemName(entry.item.name.toLocaleLowerCase("pl"))
                      : entry.section === "bosses"
                      ? setSelectedBoss(entry.boss)
                      : setSelectedNpc(entry.npc)
                  }
                  type="button"
                >
                  <Graphic
                    className={`entry-icon ${entry.section === "items" ? "item-icon" : "creature-icon"}`}
                    image={
                      entry.section === "monsters"
                        ? getMonsterImage(entry.monster)
                        : entry.section === "items"
                        ? getCatalogItemImage(entry.item)
                        : entry.section === "bosses"
                        ? getBossImage(entry.boss)
                        : entry.npc.image
                    }
                    name={entry.name}
                  />
                  <span className="entry-text">
                    <strong className={entry.section === "items" ? "item-name" : undefined}>
                      {entry.name}
                    </strong>
                    <small>{entry.caption}</small>
                  </span>
                  <span aria-hidden="true" className="entry-chevron">›</span>
                </button>
              );
            })}
            {visibleEntries.length === 0 && (
              <div className="empty-state">
                <span>⌕</span>
                <strong>Brak wyników</strong>
                <p>Spróbuj innej nazwy lub wyczyść wyszukiwanie.</p>
              </div>
            )}
          </div>

          <div className="pagination">
            <button
              aria-label="Poprzednia strona"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              ‹
            </button>
            <span>
              Strona <strong>{page}</strong> z <strong>{pageCount}</strong>
            </span>
            <button
              aria-label="Następna strona"
              disabled={page >= pageCount}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              type="button"
            >
              ›
            </button>
          </div>
        </aside>

        <section className="details" aria-live="polite">
          {section === "monsters" ? (
            <MonsterDetails
              image={getMonsterImage(selectedMonster)}
              mapPositionCount={
                monsterMapPositionCounts.get(selectedMonster.id) ?? 0
              }
              monster={selectedMonster}
              onShowOnMap={showMonsterOnMap}
              onOpenItem={openItem}
            />
          ) : section === "items" && selectedItem ? (
            <ItemDetails
              image={getCatalogItemImage(selectedItem)}
              item={selectedItem}
              onOpenMonster={openMonster}
            />
          ) : section === "bosses" ? (
            <BossDetails
              image={getBossImage(selectedBoss)}
              boss={selectedBoss}
              lootMonster={selectedBossLootMonster}
              onOpenMonster={openMonster}
            />
          ) : section === "npcs" && selectedNpc ? (
            <NPCDetails
              image={selectedNpc.image}
              npc={selectedNpc}
              onShowOnMap={showNpcOnMap}
            />
          ) : (
            <div className="empty-detail">
              {section === "items" ? "Wybierz przedmiot z listy." : section === "npcs" ? "Wybierz NPC z listy." : "Wybierz bossa z listy."}
            </div>
          )}
        </section>
      </section>
      )}

      <footer className="footer">
        <span>ApoWiki <span className="footer-divider">/</span> Wiedza o serwerze w jednym miejscu</span>
        <span>Dane gry <span className="footer-dot">•</span> Bestiariusz</span>
      </footer>
    </main>
  );
}

function getInformationCount(category: InformationCategory) {
  if (category.stages) return category.stages.length;
  if (category.gains) return category.gains.length;
  if (category.professions) {
    return Object.values(category.professions).reduce(
      (total, profession) => total + profession.spells.length + profession.soul.length,
      0,
    );
  }
  if (category.kind === "costumes") return category.entries?.length ?? 0;
  if (category.commands) return category.commands.length;
  return category.links?.length ?? 0;
}

function InformationWorkspace({
  categories,
  onOpenItem,
  onQueryChange,
  onSelect,
  query,
  selectedCategory,
}: {
  categories: InformationCategory[];
  onOpenItem: (name: string) => void;
  onQueryChange: (query: string) => void;
  onSelect: (name: string) => void;
  query: string;
  selectedCategory?: InformationCategory;
}) {
  return (
    <section className="workspace">
      <aside className="catalog">
        <div className="catalog-heading">
          <div>
            <p className="eyebrow">BAZA WIEDZY</p>
            <h2>Informacje</h2>
          </div>
          <span className="result-count">{categories.length}</span>
        </div>

        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Szukaj informacji"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Szukaj informacji..."
            type="search"
            value={query}
          />
          {query && (
            <button
              aria-label="Wyczyść wyszukiwanie"
              className="clear-search"
              onClick={() => onQueryChange("")}
              type="button"
            >
              ×
            </button>
          )}
        </label>

        <div className="entry-list" aria-live="polite">
          {categories.map((category) => (
            <button
              aria-current={selectedCategory?.name === category.name ? "true" : undefined}
              className={selectedCategory?.name === category.name ? "entry selected" : "entry"}
              key={category.name}
              onClick={() => onSelect(category.name)}
              type="button"
            >
              <span aria-hidden="true" className="entry-icon info-entry-icon">
                {category.kind === "expstage" ? "✦" : category.kind === "vocationgain" ? "♥" : category.kind === "spells" ? "✧" : category.kind === "commands" ? "⌘" : category.kind === "costumes" ? "♙" : "↗"}
              </span>
              <span className="entry-text">
                <strong>{category.name}</strong>
                <small>{getInformationCount(category)} pozycji</small>
              </span>
              <span aria-hidden="true" className="entry-chevron">›</span>
            </button>
          ))}
          {categories.length === 0 && (
            <div className="empty-state">
              <span>⌕</span>
              <strong>Brak wyników</strong>
              <p>Spróbuj innej nazwy lub wyczyść wyszukiwanie.</p>
            </div>
          )}
        </div>
      </aside>

      <section className="details info-details" aria-live="polite">
        {selectedCategory ? (
          <InformationDetails
            category={selectedCategory}
            key={selectedCategory.name}
            onOpenItem={onOpenItem}
          />
        ) : (
          <div className="empty-detail">Wybierz kategorię z listy.</div>
        )}
      </section>
    </section>
  );
}

function SystemsWorkspace({
  onQueryChange,
  onSelect,
  query,
  selectedSystem,
  systems: visibleSystems,
}: {
  onQueryChange: (query: string) => void;
  onSelect: (name: string) => void;
  query: string;
  selectedSystem?: GameSystem;
  systems: GameSystem[];
}) {
  return (
    <section className="workspace">
      <aside className="catalog">
        <div className="catalog-heading">
          <div>
            <p className="eyebrow">BAZA SYSTEMÓW</p>
            <h2>Systemy</h2>
          </div>
          <span className="result-count">{visibleSystems.length}</span>
        </div>

        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Szukaj systemów"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Szukaj systemów..."
            type="search"
            value={query}
          />
          {query && (
            <button
              aria-label="Wyczyść wyszukiwanie"
              className="clear-search"
              onClick={() => onQueryChange("")}
              type="button"
            >
              ×
            </button>
          )}
        </label>

        <div className="entry-list" aria-live="polite">
          {visibleSystems.map((system) => (
            <button
              aria-current={selectedSystem?.name === system.name ? "true" : undefined}
              className={selectedSystem?.name === system.name ? "entry selected" : "entry"}
              key={system.name}
              onClick={() => onSelect(system.name)}
              type="button"
            >
              <span aria-hidden="true" className="entry-icon info-entry-icon">⚙</span>
              <span className="entry-text">
                <strong>{system.name}</strong>
                <small>{system.category}</small>
              </span>
              <span aria-hidden="true" className="entry-chevron">›</span>
            </button>
          ))}
          {visibleSystems.length === 0 && (
            <div className="empty-state">
              <span>⌕</span>
              <strong>Brak wyników</strong>
              <p>Spróbuj innej nazwy lub wyczyść wyszukiwanie.</p>
            </div>
          )}
        </div>
      </aside>

      <section className="details info-details" aria-live="polite">
        {selectedSystem ? (
          <article>
            <div className="info-detail-heading">
              <p className="eyebrow">SYSTEM APO</p>
              <h2>{selectedSystem.name}</h2>
            </div>
            <span className="system-category-badge">{selectedSystem.category}</span>
            <section className="info-section">
              <h3>Opis</h3>
              <p className="system-description">{selectedSystem.desc}</p>
            </section>
            {selectedSystem.info.length > 0 && (
              <section className="info-section">
                <h3>Informacje</h3>
                <ul className="information-rules system-info-list">
                  {selectedSystem.info.map((detail) => <li key={detail}>{detail}</li>)}
                </ul>
              </section>
            )}
          </article>
        ) : (
          <div className="empty-detail">Wybierz system z listy.</div>
        )}
      </section>
    </section>
  );
}

function InformationDetails({
  category,
  onOpenItem,
}: {
  category: InformationCategory;
  onOpenItem: (name: string) => void;
}) {
  const [selectedProfession, setSelectedProfession] = useState("rook");

  return (
    <article>
      <div className="info-detail-heading">
        <p className="eyebrow">APOPEDIA</p>
        <h2>{category.name}</h2>
      </div>

      {category.stages ? (
        <section className="info-section">
          <h3>EXP Stage</h3>
          <div className="information-table-wrap">
            <table className="information-table">
              <thead>
                <tr><th>Poziom</th><th>Mnożnik EXP</th></tr>
              </thead>
              <tbody>
                {category.stages.map(([level, multiplier]) => (
                  <tr key={level}><td>{level}</td><td>{multiplier}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : category.gains && category.trivia ? (
        <>
          <section className="info-section">
            <h3>Przyrost na poziom</h3>
            <div className="information-table-wrap">
              <table className="information-table">
                <thead>
                  <tr><th>Profesja</th><th>HP / lvl</th><th>MP / lvl</th></tr>
                </thead>
                <tbody>
                  {category.gains.map(([vocation, hp, mp]) => (
                    <tr key={vocation}><td>{vocation}</td><td>{hp}</td><td>{mp}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="info-section">
            <h3>Ciekawostka</h3>
            <div className="information-trivia">
              <Graphic
                className="detail-emblem item-emblem"
                image={`./images/items/${category.trivia.clientId}.png`}
                name={category.trivia.name}
              />
              <div>
                <h4>{category.trivia.name}</h4>
                <p>{category.trivia.desc}</p>
                <small>Annihilator III · Main</small>
              </div>
            </div>
          </section>
        </>
      ) : category.professions ? (
        <>
          <section className="info-section">
            <h3>Profesja</h3>
            <div className="profession-tabs" aria-label="Wybierz profesję">
              {Object.entries(category.professions).map(([key, profession]) => (
                <button
                  aria-pressed={selectedProfession === key}
                  className={selectedProfession === key ? "profession-tab active" : "profession-tab"}
                  key={key}
                  onClick={() => setSelectedProfession(key)}
                  type="button"
                >
                  {profession.name}
                </button>
              ))}
            </div>
          </section>
          {Object.entries(category.professions)
            .filter(([key]) => key === selectedProfession)
            .map(([key, profession]) => (
              <div className="info-section" key={key}>
                <h3>Czary <span>{profession.spells.length}</span></h3>
                <div className="information-table-wrap">
                  <table className="information-table">
                    <thead>
                      <tr><th>Czar</th><th>Formuła</th><th>Mana</th><th>Poziom</th></tr>
                    </thead>
                    <tbody>
                      {profession.spells.map(([name, words, mana, level]) => (
                        <tr key={words}><td>{name}</td><td><code>{words}</code></td><td>{mana}</td><td>{level}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {profession.soul.length > 0 && (
                  <>
                    <h3 className="info-subheading">Czary za Soul Pointy <span>{profession.soul.length}</span></h3>
                    <div className="information-table-wrap">
                      <table className="information-table">
                        <thead>
                          <tr><th>Formuła</th><th>Koszt</th><th>Efekt</th></tr>
                        </thead>
                        <tbody>
                          {profession.soul.map(([name, cost, description]) => (
                            <tr key={name}><td><code>{name}</code></td><td>{cost}</td><td>{description}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            ))}
        </>
      ) : category.kind === "costumes" && category.entries && category.rules ? (
        <>
          <p className="costume-credit">
            Poradnik został przygotowany przez <strong>Ektoplazma</strong>.
          </p>
          <section className="info-section">
            <h3>Ważne informacje</h3>
            <ul className="information-rules">
              {category.rules.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
          </section>
          {category.entries.map((costume) => {
            const appearanceMonster = monsters.find(
              (monster) => monster.name === costume.appearanceMonster,
            );
            return (
              <section className="info-section" key={costume.name}>
                <div className="costume-appearance">
                  <Graphic
                    className="entry-icon creature-icon"
                    image={appearanceMonster ? getMonsterImage(appearanceMonster) : undefined}
                    name={costume.appearanceMonster}
                  />
                </div>
                <h3 className="costume-title">
                  {costume.name}
                </h3>
                {costume.description && <p className="costume-description">{costume.description}</p>}
                <div className="information-table-wrap">
                  <table className="information-table">
                    <thead>
                      <tr><th>#</th><th>Ilość</th><th>Przedmiot</th><th>Uwagi</th></tr>
                    </thead>
                    <tbody>
                      {costume.items.map((item, itemIndex) => (
                        <tr key={`${item.name}-${itemIndex}`}>
                          <td>{itemIndex + 1}</td>
                          <td>{item.amount}</td>
                          <td>
                            <button
                              className="costume-item-link"
                              onClick={() => onOpenItem(item.name)}
                              type="button"
                            >
                              {item.name}
                            </button>
                          </td>
                          <td>{item.note ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {costume.reward && (
                  <div className="information-trivia costume-reward">
                    <div>
                      <p className="eyebrow">NAGRODA · KOSTIUM GRINCHA</p>
                      <p>{costume.reward}</p>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </>
      ) : category.commands ? (
        <section className="info-section">
          <h3>Komendy dostępne w grze <span>{category.commands.length}</span></h3>
          <div className="information-table-wrap">
            <table className="information-table">
              <thead>
                <tr><th>Komenda</th><th>Działanie</th></tr>
              </thead>
              <tbody>
                {category.commands.map(([command, description]) => (
                  <tr key={command}><td><code>{command}</code></td><td>{description}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="info-section">
          <h3>Przydatne odnośniki</h3>
          <div className="information-links">
            {category.links?.map((link) => (
              <a href={link.url} key={link.url} rel="noreferrer" target="_blank">
                <span>
                  <strong>{link.name}</strong>
                  <small>{link.info}</small>
                </span>
                <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

function MonsterDetails({
  image,
  mapPositionCount,
  monster,
  onShowOnMap,
  onOpenItem,
}: {
  image?: string;
  mapPositionCount: number;
  monster: Monster;
  onShowOnMap: (monster: Monster) => void;
  onOpenItem: (name: string) => void;
}) {
  const sortedLoot = [...monster.loot].sort(compareLootFrequency);

  return (
    <article>
      <div className="detail-hero">
        <Graphic
          className="detail-emblem creature-emblem"
          image={image}
          name={monster.name}
        />
        <div className="detail-title">
          <p className="eyebrow">KARTA POTWORA</p>
          <h2>{monster.name}</h2>
          <p className="detail-caption">Informacje i możliwy łup</p>
        </div>
        <span className="data-badge">BESTIARIUSZ</span>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-symbol health-symbol">♥</span>
          <span className="stat-label">Punkty życia</span>
          <strong>{formatNumber(monster.hp)}</strong>
          <small>HP</small>
        </div>
        <div className="stat-card">
          <span className="stat-symbol exp-symbol">✦</span>
          <span className="stat-label">Doświadczenie</span>
          <strong>{formatNumber(monster.exp)}</strong>
          <small>EXP</small>
        </div>
        <div className="stat-card">
          <span className="stat-symbol loot-symbol">◇</span>
          <span className="stat-label">Możliwe łupy</span>
          <strong>{monster.loot.length}</strong>
          <small>PRZEDMIOTÓW</small>
        </div>
      </div>

      {mapPositionCount > 0 && (
        <section
          aria-label="Lokalizacje potwora na mapie"
          className="npc-map-coordinates"
        >
          <span className="eyebrow">LOKALIZACJE NA MAPIE</span>
          <div className="npc-map-coordinate-list">
            <button
              className="npc-map-coordinate"
              onClick={() => onShowOnMap(monster)}
              type="button"
            >
              <span>Zobacz pozycje potwora</span>
              <strong>{formatNumber(mapPositionCount)}</strong>
              <span aria-hidden="true">⌖</span>
            </button>
          </div>
        </section>
      )}

      <div className="section-heading">
        <div>
          <p className="eyebrow">NAGRODY ZA POLOWANIE</p>
          <h3>Możliwy łup <span>{monster.loot.length}</span></h3>
        </div>
        <span className="heading-note">Kliknij przedmiot, aby zobaczyć jego źródła</span>
      </div>

      <div className="loot-list">
        {sortedLoot.map((loot) => (
          <button
            className={`loot-row loot-row-${loot.frequency.toLowerCase().replace(/\s+/g, "-")}`}
            key={`${loot.name}-${loot.frequency}`}
            onClick={() => onOpenItem(loot.name)}
            type="button"
          >
            <Graphic
              className="loot-icon item-icon"
              image={getItemImage(loot.name)}
              name={loot.name}
            />
            <span className="loot-name item-name">{loot.name}</span>
            <span className="loot-amount">
              {loot.amount > 1 ? `${formatLootAmount(loot.amount)} ×` : "× 1"}
            </span>
            <span className={`frequency frequency-${loot.frequency.toLowerCase().replace(/\s+/g, "-")}`}>
              {loot.frequency}
            </span>
            <span aria-hidden="true" className="row-chevron">↗</span>
          </button>
        ))}
      </div>
    </article>
  );
}

function ItemDetails({
  image,
  item,
  onOpenMonster,
}: {
  image?: string;
  item: Item;
  onOpenMonster: (monster: Monster) => void;
}) {
  const sortedDrops = [...item.drops].sort((a, b) =>
    compareLootFrequency(a.loot, b.loot),
  );

  return (
    <article>
      <div className="detail-hero">
        <Graphic
          className="detail-emblem item-emblem"
          image={image}
          name={item.name}
        />
        <div className="detail-title">
          <p className="eyebrow">KARTA PRZEDMIOTU</p>
          <h2 className="item-name">{item.name}</h2>
          <p className="detail-caption">
            {item.categories?.map(getItemCategoryLabel).join(" · ") || "Przedmiot"}
            {item.zones?.length ? ` · ${item.zones.map((zone) => zone.toUpperCase()).join(" / ")}` : ""}
          </p>
        </div>
        <span className="data-badge item-badge">PRZEDMIOT</span>
      </div>

      <div className="item-summary">
        <span className="summary-icon">⌖</span>
        <div>
          <strong>{item.drops.length ? "Znane źródła" : "Źródła przedmiotu"}</strong>
          <p>
            {item.drops.length ? (
              <>
                Ten przedmiot może wypaść z{" "}
                <strong>{formatNumber(item.drops.length)} {item.drops.length === 1 ? "potwora" : "potworów"}</strong>.
              </>
            ) : (
              "Brak znanych źródeł łupu w bestiariuszu."
            )}
          </p>
        </div>
      </div>

      {item.descriptions && Object.keys(item.descriptions).length > 0 && (
        <section className="item-descriptions" aria-label="Opis przedmiotu">
          {(["main", "rook"] as const).map((zone) => {
            const description = item.descriptions?.[zone];
            if (!description) return null;
            return (
              <div className="item-description" key={zone}>
                <span className="eyebrow">OPIS · {zone.toUpperCase()}</span>
                <p>{description}</p>
              </div>
            );
          })}
        </section>
      )}

      {item.drops.length > 0 && (
        <>
          <div className="section-heading">
            <div>
              <p className="eyebrow">BESTIARIUSZ</p>
              <h3>Wypada z <span>{item.drops.length}</span></h3>
            </div>
            <span className="heading-note">Kliknij potwora, aby zobaczyć jego kartę</span>
          </div>

          <div className="source-list">
            {sortedDrops.map(({ monster, loot }) => (
              <button
                className="source-row"
                key={`${monster.id}-${loot.frequency}`}
                onClick={() => onOpenMonster(monster)}
                type="button"
              >
                <Graphic
                  className="entry-icon creature-icon"
                  image={getMonsterImage(monster)}
                  name={monster.name}
                />
                <span className="source-name">
                  <strong>{monster.name}</strong>
                  <small>{formatNumber(monster.hp)} HP <span>·</span> {formatNumber(monster.exp)} EXP</small>
                </span>
                <span className="source-loot">
                  <span className="source-loot-amount">
                    {formatLootAmount(loot.amount)} ×
                  </span>
                  <strong className={`frequency frequency-${loot.frequency.toLowerCase().replace(/\s+/g, "-")}`}>
                    {loot.frequency}
                  </strong>
                </span>
                <span aria-hidden="true" className="row-chevron">↗</span>
              </button>
            ))}
          </div>
        </>
      )}
    </article>
  );
}

function BossDetails({
  image,
  boss,
  lootMonster,
  onOpenMonster,
}: {
  image?: string;
  boss: Boss;
  lootMonster?: Monster;
  onOpenMonster: (monster: Monster) => void;
}) {
  return (
    <article>
      <div className="detail-hero">
        <Graphic
          className="detail-emblem creature-emblem"
          image={image}
          name={boss.name}
        />
        <div className="detail-title">
          <p className="eyebrow">KARTA BOSSA</p>
          <h2>{boss.name}</h2>
          <p className="detail-caption">{getBossRegionLabel(boss.region)}</p>
        </div>
        <span className="data-badge boss-badge">UNIKALNY BOSS</span>
      </div>

      <section className="boss-description">
        <p className="eyebrow">OPIS</p>
        <p>{boss.description}</p>
      </section>
      {lootMonster?.loot.length ? (
        <button
          className="boss-loot-button"
          onClick={() => onOpenMonster(lootMonster)}
          type="button"
        >
          <span aria-hidden="true">◇</span>
          Zobacz łup
          <small>{lootMonster.loot.length}</small>
          <span aria-hidden="true">↗</span>
        </button>
      ) : null}
    </article>
  );
}

function NPCDetails({
  image,
  npc,
  onShowOnMap,
}: {
  image?: string;
  npc: NPC;
  onShowOnMap: (npc: NPC, position: MapNpcLocation) => void;
}) {
  return (
    <article>
      <div className="detail-hero">
        <Graphic
          className="detail-emblem creature-emblem"
          image={image}
          name={npc.name}
        />
        <div className="detail-title">
          <p className="eyebrow">KARTA NPC</p>
          <h2>{npc.name}</h2>
          <p className="detail-caption">{npc.region} · {npc.category}</p>
        </div>
        <span className="data-badge">{npc.region}</span>
      </div>

      <section className="npc-meta" aria-label="Informacje o NPC">
        <div>
          <span className="eyebrow">LOKALIZACJA</span>
          <strong>{npc.location}</strong>
        </div>
        {npc.profession && (
          <div>
            <span className="eyebrow">FUNKCJA</span>
            <strong>{npc.profession}</strong>
          </div>
        )}
      </section>

      {npc.mapPositions && npc.mapPositions.length > 0 && (
        <section className="npc-map-coordinates" aria-label="Współrzędne NPC na mapie">
          <span className="eyebrow">WSPÓŁRZĘDNE NA MAPIE</span>
          <div className="npc-map-coordinate-list">
            {npc.mapPositions.map((position, index) => (
              <button
                className="npc-map-coordinate"
                key={`${position.floor}:${position.x}:${position.y}:${index}`}
                onClick={() => onShowOnMap(npc, position)}
                type="button"
              >
                <span>Poziom {position.floor > 0 ? `+${position.floor}` : position.floor}</span>
                <strong>{position.x} × {position.y}</strong>
                <span aria-hidden="true">⌖</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {npc.locationImage && (
        <figure className="npc-location-figure">
          <img
            alt={`Mapa z trasą do NPC ${npc.name}`}
            className="npc-location-image"
            src={npc.locationImage}
          />
          <figcaption>Trasa do Ward Robe w Capital City</figcaption>
        </figure>
      )}

      <section className="boss-description npc-description">
        <p className="eyebrow">OPIS</p>
        <p>{npc.description}</p>
      </section>
    </article>
  );
}

function MapWorkspace({
  houses,
  locations,
  mapMonsterSearchNames,
  monsterMapCategories,
  monsterMapLoadError,
  monsterMapLoadStatus,
  monsterMapRequest,
  npcMapRequest,
  npcs,
  onLoadMonsterLocations,
  positions,
}: {
  houses: MapHouse[];
  locations: MapLocation[];
  mapMonsterSearchNames: string[];
  monsterMapCategories: MonsterMapCategory[];
  monsterMapLoadError: string;
  monsterMapLoadStatus: "idle" | "loading" | "ready" | "error";
  monsterMapRequest?: MapMonsterMapRequest;
  npcMapRequest?: MapNpcMapRequest;
  npcs: NPC[];
  onLoadMonsterLocations: () => void;
  positions: MapNpcPosition[];
}) {
  const [floor, setFloor] = useState(0);
  const [markerLayer, setMarkerLayer] = useState<MapMarkerLayer>("");
  const [searchValue, setSearchValue] = useState("");
  const [selectedNpcId, setSelectedNpcId] = useState<number | null>(null);
  const [selectedPositionKey, setSelectedPositionKey] = useState<string | null>(
    null,
  );
  const [selectedMonsterId, setSelectedMonsterId] = useState<number | null>(
    null,
  );
  const [selectedMapOnlyMonsterCategoryId, setSelectedMapOnlyMonsterCategoryId] =
    useState<number | null>(null);
  const [selectedMonsterPositionKey, setSelectedMonsterPositionKey] = useState<
    string | null
  >(null);
  const [selectedHouseId, setSelectedHouseId] = useState<number | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null,
  );
  const [searchMessage, setSearchMessage] = useState("");
  const [zoom, setZoom] = useState(defaultMapZoom);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [imageError, setImageError] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const viewRef = useRef({ zoom, pan });
  viewRef.current = { zoom, pan };
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const focusPendingRef = useRef(false);
  const selectedNpc =
    selectedNpcId === null
      ? undefined
      : npcs.find((npc) => npc.id === selectedNpcId);
  const selectedPosition =
    selectedNpcId === null
      ? undefined
      : positions.find(
          (position) =>
            position.npcId === selectedNpcId &&
            (selectedPositionKey === null ||
              getMapPositionKey(position) === selectedPositionKey),
        ) ?? positions.find((position) => position.npcId === selectedNpcId);
  const activeMonsterCategories =
    selectedMonsterId !== null
      ? monsterMapCategories.filter(
          (category) => category.monsterIds.includes(selectedMonsterId),
        )
      : selectedMapOnlyMonsterCategoryId !== null
        ? monsterMapCategories.filter(
            (category) => category.id === selectedMapOnlyMonsterCategoryId,
          )
        : [];
  const selectedMonsterPosition = activeMonsterCategories.flatMap((category) =>
    category.positions.map(([floor, x, y], positionIndex) => ({
      categoryId: category.id,
      positionIndex,
      position: { floor, x, y },
    })),
  ).find(
    (entry) =>
      getMapMonsterPositionKey(entry.categoryId, entry.positionIndex) ===
      selectedMonsterPositionKey,
  );
  const selectedHouse =
    selectedHouseId === null
      ? undefined
      : houses.find((house) => house.id === selectedHouseId);
  const selectedLocation =
    selectedLocationId === null
      ? undefined
      : locations.find((location) => location.id === selectedLocationId);
  const imageName =
    floor === 0 ? "level_0.png" : `level_${floor > 0 ? `+${floor}` : floor}.png`;

  function clearSelectedMonster() {
    setSelectedMonsterId(null);
    setSelectedMapOnlyMonsterCategoryId(null);
    setSelectedMonsterPositionKey(null);
  }

  function selectMonsterPosition(
    category: MonsterMapCategory,
    positionIndex: number,
  ) {
    const tuple = category.positions[positionIndex];
    if (!tuple) return;
    const [targetFloor, x, y] = tuple;
    const categoryMonsterId = category.monsterIds[0];
    const monster =
      categoryMonsterId === undefined
        ? undefined
        : monsters.find((entry) => entry.id === categoryMonsterId);
    const displayName = monster?.name ?? category.name;
    setMarkerLayer("monsters");
    setSelectedNpcId(null);
    setSelectedPositionKey(null);
    setSelectedHouseId(null);
    setSelectedLocationId(null);
    setSelectedMonsterId(categoryMonsterId ?? null);
    setSelectedMapOnlyMonsterCategoryId(
      categoryMonsterId === undefined ? category.id : null,
    );
    setSelectedMonsterPositionKey(
      getMapMonsterPositionKey(category.id, positionIndex),
    );
    setSearchValue(displayName);
    setSearchMessage(
      `${displayName}: poziom ${targetFloor}, pozycja ${x} × ${y}.`,
    );
    focusPendingRef.current = true;
    setFocusRequest((request) => request + 1);
    setFloor(targetFloor);
  }

  function showMonsterLocations(monsterId: number) {
    focusPendingRef.current = false;
    const category = monsterMapCategories.find(
      (entry) =>
        entry.monsterIds.includes(monsterId) && entry.positions.length > 0,
    );
    if (!category) {
      const monster = monsters.find((entry) => entry.id === monsterId);
      setSearchMessage(
        `Brak lokalizacji potwora ${monster?.name ?? ""} na mapie.`,
      );
      return;
    }

    const monster = monsters.find((entry) => entry.id === monsterId);
    const positionCount = monsterMapCategories
      .filter((entry) => entry.monsterIds.includes(monsterId))
      .reduce((count, entry) => count + entry.positions.length, 0);
    setMarkerLayer("monsters");
    setSelectedNpcId(null);
    setSelectedPositionKey(null);
    setSelectedHouseId(null);
    setSelectedLocationId(null);
    setSelectedMonsterId(monsterId);
    setSelectedMapOnlyMonsterCategoryId(null);
    setSelectedMonsterPositionKey(null);
    setSearchValue(monster?.name ?? category.name);
    setSearchMessage(
      `Pokazano ${positionCount} lokalizacji: ${monster?.name ?? category.name}. Kliknij marker, aby przejść do poziomu i przybliżyć pozycję.`,
    );
  }

  function constrainPan(nextPan: { x: number; y: number }, nextZoom: number) {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) return nextPan;

    const canvasLeft = (viewport.clientWidth - canvas.clientWidth) / 2;
    const canvasTop = (viewport.clientHeight - canvas.clientHeight) / 2;
    const scaledWidth = canvas.clientWidth * nextZoom;
    const scaledHeight = canvas.clientHeight * nextZoom;
    const constrainAxis = (
      offset: number,
      canvasOffset: number,
      scaledSize: number,
      viewportSize: number,
    ) => {
      if (scaledSize <= viewportSize) return 0;
      return Math.min(
        -canvasOffset,
        Math.max(viewportSize - canvasOffset - scaledSize, offset),
      );
    };

    return {
      x: constrainAxis(
        nextPan.x,
        canvasLeft,
        scaledWidth,
        viewport.clientWidth,
      ),
      y: constrainAxis(
        nextPan.y,
        canvasTop,
        scaledHeight,
        viewport.clientHeight,
      ),
    };
  }

  useEffect(() => {
    if (!npcMapRequest) return;
    const npc = npcs.find((entry) => entry.id === npcMapRequest.npcId);
    if (!npc) {
      setSearchMessage("Nie znaleziono NPC do pokazania na mapie.");
      return;
    }

    setMarkerLayer("npcs");
    setSelectedHouseId(null);
    setSelectedLocationId(null);
    clearSelectedMonster();
    setSelectedNpcId(npc.id);
    setSelectedPositionKey(
      getMapPositionKey({ npcId: npc.id, ...npcMapRequest.position }),
    );
    setSearchValue(npc.name);
    setSearchMessage(
      `${npc.name}: poziom ${npcMapRequest.position.floor}, pozycja ${npcMapRequest.position.x} × ${npcMapRequest.position.y}.`,
    );
    focusPendingRef.current = true;
    setFocusRequest((request) => request + 1);
    setFloor(npcMapRequest.position.floor);
  }, [npcMapRequest, npcs]);

  useEffect(() => {
    if (!monsterMapRequest) return;
    if (monsterMapLoadStatus !== "ready") return;
    const category = monsterMapCategories.find(
      (entry) =>
        entry.monsterIds.includes(monsterMapRequest.monsterId) &&
        entry.positions.length > 0,
    );
    if (!category) {
      setSearchMessage("Nie znaleziono lokalizacji tego potwora na mapie.");
      return;
    }

    showMonsterLocations(monsterMapRequest.monsterId);
  }, [monsterMapRequest, monsterMapCategories, monsterMapLoadStatus]);

  useEffect(() => {
    const targetPosition =
      selectedMonsterPosition?.position ??
      selectedLocation?.position ??
      selectedHouse?.position ??
      selectedPosition;
    if (!focusPendingRef.current || targetPosition?.floor !== floor) return;
    focusPendingRef.current = false;

    window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      const canvas = canvasRef.current;
      if (!viewport || !canvas) return;

      const targetZoom = 5;
      const canvasWidth = canvas.clientWidth;
      const canvasHeight = canvas.clientHeight;
      const canvasLeft = (viewport.clientWidth - canvasWidth) / 2;
      const canvasTop = (viewport.clientHeight - canvasHeight) / 2;
      const targetX = (targetPosition.x / mapDimensions.width) * canvasWidth;
      const targetY = (targetPosition.y / mapDimensions.height) * canvasHeight;

      setZoom(targetZoom);
      setPan(
        constrainPan(
          {
            x: viewport.clientWidth / 2 - canvasLeft - targetX * targetZoom,
            y: viewport.clientHeight / 2 - canvasTop - targetY * targetZoom,
          },
          targetZoom,
        ),
      );
    });
  }, [
    floor,
    focusRequest,
    selectedHouse,
    selectedLocation,
    selectedPosition,
    selectedMonsterPosition,
  ]);

  useEffect(() => {
    function resetViewOnResize() {
      setZoom(defaultMapZoom);
      setPan({ x: 0, y: 0 });
    }

    window.addEventListener("resize", resetViewOnResize);
    return () => window.removeEventListener("resize", resetViewOnResize);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const mapViewport = viewport;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      const { zoom: currentZoom, pan: currentPan } = viewRef.current;
      const nextZoom = Math.min(
        maxMapZoom,
        Math.max(0.5, currentZoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15)),
      );
      const canvas = canvasRef.current;
      if (!canvas) return;

      const canvasLeft = (mapViewport.clientWidth - canvas.clientWidth) / 2;
      const canvasTop = (mapViewport.clientHeight - canvas.clientHeight) / 2;
      const centerX = mapViewport.clientWidth / 2;
      const centerY = mapViewport.clientHeight / 2;
      const mapX = (centerX - canvasLeft - currentPan.x) / currentZoom;
      const mapY = (centerY - canvasTop - currentPan.y) / currentZoom;
      setPan(
        constrainPan(
          {
            x: centerX - canvasLeft - mapX * nextZoom,
            y: centerY - canvasTop - mapY * nextZoom,
          },
          nextZoom,
        ),
      );
      setZoom(nextZoom);
    }

    mapViewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => mapViewport.removeEventListener("wheel", handleWheel);
  }, []);

  function chooseNpc(npc: NPC, targetPosition?: MapNpcPosition) {
    setMarkerLayer("npcs");
    setSelectedHouseId(null);
    setSelectedLocationId(null);
    clearSelectedMonster();
    setSelectedNpcId(npc.id);
    setSearchValue(npc.name);
    const position =
      targetPosition ?? positions.find((entry) => entry.npcId === npc.id);
    if (!position) {
      focusPendingRef.current = false;
      setSearchMessage(`Brak współrzędnych NPC ${npc.name}.`);
      return;
    }

    setSelectedPositionKey(getMapPositionKey(position));
    focusPendingRef.current = true;
    setFocusRequest((request) => request + 1);
    setFloor(position.floor);
    setSearchMessage(
      `${npc.name}: poziom ${position.floor}, pozycja ${position.x} × ${position.y}.`,
    );
  }

  function searchMapMarker(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = searchValue.trim().toLocaleLowerCase("pl");
    if (markerLayer === "") {
      setSearchMessage(
        "Najpierw wybierz kategorię markerów: NPC, Potwory, Domki lub Lokalizacje.",
      );
      return;
    }
    if (markerLayer === "npcs") {
      const npc = npcs.find(
        (entry) => entry.name.toLocaleLowerCase("pl") === normalizedName,
      );
      if (!npc) {
        setSearchMessage(`Nie znaleziono NPC „${searchValue.trim()}”.`);
        return;
      }
      chooseNpc(npc);
      return;
    }

    if (markerLayer === "monsters") {
      const monster = monsters.find(
        (entry) => entry.name.toLocaleLowerCase("pl") === normalizedName,
      );
      if (monster) {
        const category = monsterMapCategories.find(
          (entry) =>
            entry.monsterIds.includes(monster.id) && entry.positions.length > 0,
        );
        if (category) {
          showMonsterLocations(monster.id);
          return;
        }
      }

      const category = monsterMapCategories.find(
        (entry) =>
          entry.monsterIds.length === 0 &&
          entry.name.toLocaleLowerCase("pl") === normalizedName,
      );
      if (!category) {
        setSearchMessage(
          monster
            ? `Brak lokalizacji potwora ${monster.name} na mapie.`
            : `Nie znaleziono potwora „${searchValue.trim()}”.`,
        );
        return;
      }
      setMarkerLayer("monsters");
      setSelectedNpcId(null);
      setSelectedPositionKey(null);
      setSelectedHouseId(null);
      setSelectedLocationId(null);
      setSelectedMonsterId(null);
      setSelectedMapOnlyMonsterCategoryId(category.id);
      setSelectedMonsterPositionKey(null);
      setSearchValue(category.name);
      setSearchMessage(
        `Pokazano ${category.positions.length} lokalizacji: ${category.name}. Kliknij marker, aby przejść do poziomu i przybliżyć pozycję.`,
      );
      return;
    }

    if (markerLayer === "locations") {
      const location = locations.find(
        (entry) => entry.name.toLocaleLowerCase("pl") === normalizedName,
      );
      if (!location) {
        setSearchMessage(`Nie znaleziono lokalizacji „${searchValue.trim()}”.`);
        return;
      }
      setSelectedNpcId(null);
      setSelectedPositionKey(null);
      clearSelectedMonster();
      setSelectedHouseId(null);
      setSelectedLocationId(location.id);
      focusPendingRef.current = true;
      setFocusRequest((request) => request + 1);
      setFloor(location.position.floor);
      setSearchMessage(
        `${location.name}: poziom ${location.position.floor}, pozycja ${location.position.x} × ${location.position.y}.`,
      );
      return;
    }

    const house = houses.find(
      (entry) => entry.name.toLocaleLowerCase("pl") === normalizedName,
    );
    if (!house) {
      setSearchMessage(`Nie znaleziono domku „${searchValue.trim()}”.`);
      return;
    }
    setSelectedNpcId(null);
    setSelectedPositionKey(null);
    clearSelectedMonster();
    setSelectedLocationId(null);
    setSelectedHouseId(house.id);
    focusPendingRef.current = true;
    setFocusRequest((request) => request + 1);
    setFloor(house.position.floor);
    setSearchMessage(
      `${house.name}: poziom ${house.position.floor}, pozycja ${house.position.x} × ${house.position.y}.`,
    );
  }

  function changeZoom(nextZoom: number) {
    const boundedZoom = Math.min(maxMapZoom, Math.max(0.5, nextZoom));
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) {
      setZoom(boundedZoom);
      return;
    }

    const canvasLeft = (viewport.clientWidth - canvas.clientWidth) / 2;
    const canvasTop = (viewport.clientHeight - canvas.clientHeight) / 2;
    const centerX = viewport.clientWidth / 2;
    const centerY = viewport.clientHeight / 2;
    const mapX = (centerX - canvasLeft - pan.x) / zoom;
    const mapY = (centerY - canvasTop - pan.y) / zoom;
    setPan(
      constrainPan(
        {
          x: centerX - canvasLeft - mapX * boundedZoom,
          y: centerY - canvasTop - mapY * boundedZoom,
        },
        boundedZoom,
      ),
    );
    setZoom(boundedZoom);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      (event.target as HTMLElement).closest("button")
    ) {
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan(
      constrainPan(
        {
          x: drag.panX + event.clientX - drag.startX,
          y: drag.panY + event.clientY - drag.startY,
        },
        zoom,
      ),
    );
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <section className="map-workspace" aria-label="Interaktywna mapa świata">
      <div className="map-toolbar">
        <div className="map-heading">
          <p className="eyebrow">MAPA ŚWIATA</p>
          <h2>Minimapa</h2>
        </div>
        <div className="map-controls">
          <label className="map-floor-select">
            <span>Markery</span>
            <select
              aria-label="Wybierz markery na mapie"
              onChange={(event) => {
                const nextLayer = event.target.value as MapMarkerLayer;
                setMarkerLayer(nextLayer);
                setSelectedNpcId(null);
                setSelectedPositionKey(null);
                clearSelectedMonster();
                setSelectedHouseId(null);
                setSelectedLocationId(null);
                setSearchValue("");
                setSearchMessage("");
                if (nextLayer === "monsters") onLoadMonsterLocations();
              }}
              value={markerLayer}
            >
              <option value="">Brak</option>
              <option value="npcs">NPC</option>
              <option value="monsters">Potwory</option>
              <option value="houses">Domki</option>
              <option value="locations">Lokalizacje</option>
            </select>
          </label>
          <label className="map-floor-select">
            <span>Poziom</span>
            <select
              aria-label="Wybierz poziom mapy"
              onChange={(event) => {
                setFloor(Number(event.target.value));
                setSelectedNpcId(null);
                setSelectedPositionKey(null);
                setSelectedMonsterPositionKey(null);
                setSelectedHouseId(null);
                setSelectedLocationId(null);
                setSearchMessage("");
              }}
              value={floor}
            >
              {mapFloors.map((level) => (
                <option key={level} value={level}>
                  {level > 0 ? `+${level}` : level}
                </option>
              ))}
            </select>
          </label>
          <form className="map-search" onSubmit={searchMapMarker}>
            <label className="map-search-field">
              <span className="eyebrow">
                {markerLayer === "houses"
                  ? "SZUKAJ DOMKU"
                  : markerLayer === "locations"
                    ? "SZUKAJ LOKALIZACJI"
                    : markerLayer === "monsters"
                      ? "SZUKAJ POTWORA"
                    : markerLayer === "npcs"
                      ? "SZUKAJ NPC"
                      : "WYSZUKIWARKA"}
              </span>
              <input
                aria-label={
                  markerLayer === "houses"
                    ? "Wyszukaj domek na mapie"
                    : markerLayer === "locations"
                      ? "Wyszukaj lokalizację na mapie"
                      : markerLayer === "monsters"
                        ? "Wyszukaj potwora na mapie"
                      : "Wyszukaj NPC na mapie"
                }
                disabled={
                  markerLayer === "" ||
                  (markerLayer === "monsters" &&
                    monsterMapLoadStatus !== "ready")
                }
                list={
                  markerLayer === "houses"
                    ? "map-house-names"
                    : markerLayer === "locations"
                      ? "map-location-names"
                      : markerLayer === "monsters"
                        ? "map-monster-names"
                      : "map-npc-names"
                }
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={
                  markerLayer === "houses"
                    ? "Wpisz nazwę domku..."
                    : markerLayer === "npcs"
                      ? "Wpisz nazwę NPC..."
                      : markerLayer === "monsters"
                        ? "Wpisz nazwę potwora..."
                      : markerLayer === "locations"
                        ? "Wpisz nazwę lokalizacji..."
                        : "Najpierw wybierz markery"
                }
                type="search"
                value={searchValue}
              />
              <datalist
                id={
                  markerLayer === "houses"
                    ? "map-house-names"
                    : markerLayer === "locations"
                      ? "map-location-names"
                      : markerLayer === "monsters"
                        ? "map-monster-names"
                      : "map-npc-names"
                }
              >
                {markerLayer === "houses"
                  ? houses.map((house) => (
                      <option key={house.id} value={house.name} />
                    ))
                  : markerLayer === "locations"
                    ? locations.map((location) => (
                        <option key={location.id} value={location.name} />
                      ))
                    : markerLayer === "monsters"
                      ? mapMonsterSearchNames.map((name) => (
                          <option key={name} value={name} />
                        ))
                    : npcs.map((npc) => (
                        <option key={npc.id} value={npc.name} />
                      ))}
              </datalist>
            </label>
            <button
              className="map-search-button"
              disabled={
                markerLayer === "" ||
                (markerLayer === "monsters" &&
                  monsterMapLoadStatus !== "ready")
              }
              type="submit"
            >
              Pokaż
            </button>
          </form>
          <div className="map-zoom-controls" aria-label="Sterowanie powiększeniem">
            <button
              aria-label="Powiększ mapę"
              onClick={() => changeZoom(zoom * 1.25)}
              type="button"
            >
              +
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              aria-label="Pomniejsz mapę"
              onClick={() => changeZoom(zoom / 1.25)}
              type="button"
            >
              −
            </button>
            <button
              className="map-reset-button"
              onClick={() => {
                setZoom(defaultMapZoom);
                setPan({ x: 0, y: 0 });
              }}
              type="button"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {markerLayer === "monsters" && monsterMapLoadStatus === "loading" && (
        <p className="map-status" role="status">
          Wczytywanie lokalizacji potworów…
        </p>
      )}
      {markerLayer === "monsters" && monsterMapLoadStatus === "error" && (
        <p className="map-error" role="alert">
          {monsterMapLoadError}
        </p>
      )}

      {(searchMessage || (selectedNpc && selectedPosition)) && (
        <div className="map-status" aria-live="polite">
          {searchMessage ||
            `Testowa pozycja ${selectedNpc?.name}: poziom ${selectedPosition?.floor}, ${selectedPosition?.x} × ${selectedPosition?.y}.`}
        </div>
      )}

      <div
        aria-label={`Mapa poziomu ${floor > 0 ? `+${floor}` : floor}`}
        className={`map-viewport${floor === 0 ? " map-viewport-floor-zero" : ""}`}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={viewportRef}
        role="region"
      >
        <div
          className="map-canvas"
          ref={canvasRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <img
            alt={`Mapa poziomu ${floor > 0 ? `+${floor}` : floor}`}
            draggable={false}
            onError={() => setImageError(true)}
            onLoad={() => setImageError(false)}
            src={`./maps/${imageName}`}
          />
          {positions
            .filter(
              (position) =>
                markerLayer === "npcs" && position.floor === floor,
            )
            .map((position) => {
              const npc = npcs.find((entry) => entry.id === position.npcId);
              if (!npc) return null;
              const isSelected =
                selectedNpcId === npc.id &&
                selectedPositionKey === getMapPositionKey(position);
              return (
                <div
                  className={`map-npc-marker${isSelected ? " selected" : ""}`}
                  key={getMapPositionKey(position)}
                  style={{
                    left: `${(position.x / mapDimensions.width) * 100}%`,
                    top: `${(position.y / mapDimensions.height) * 100}%`,
                    transform: `translate(-50%, -50%) scale(${1 / zoom})`,
                  }}
                >
                  <button
                    aria-expanded={isSelected}
                    aria-label={`${npc.name}, pozycja ${position.x} × ${position.y}`}
                    className="map-npc-icon-button"
                    onClick={() => chooseNpc(npc, position)}
                    title={npc.name}
                    type="button"
                  >
                    <MapNpcIcon />
                  </button>
                  {isSelected && (
                    <div
                      aria-label={`Informacje o NPC ${npc.name}`}
                      className="map-npc-popup"
                      role="dialog"
                    >
                      <button
                        aria-label={`Zamknij informacje o NPC ${npc.name}`}
                        className="map-house-popup-close"
                        onClick={() => {
                          setSelectedNpcId(null);
                          setSelectedPositionKey(null);
                          setSearchMessage("");
                        }}
                        type="button"
                      >
                        ×
                      </button>
                      <div className="map-house-popup-heading">
                        <MapNpcIcon />
                        <div>
                          <strong>{npc.name}</strong>
                          <button
                            className="map-house-popup-floor"
                            onClick={() => setFloor(position.floor)}
                            type="button"
                          >
                            Poziom{" "}
                            {position.floor > 0 ? `+${position.floor}` : position.floor}
                          </button>
                        </div>
                      </div>
                      <p className="map-npc-popup-description">{npc.description}</p>
                    </div>
                  )}
                </div>
              );
            })}
          {activeMonsterCategories.map((category) => {
            const monster =
              category.monsterIds.length === 0
                ? undefined
                : monsters.find(
                    (entry) => entry.id === category.monsterIds[0],
                  );
            const displayName = monster?.name ?? category.name;
            return category.positions.map(([markerFloor, x, y], positionIndex) => {
              const isSelected =
                selectedMonsterPositionKey ===
                getMapMonsterPositionKey(category.id, positionIndex);
              const isOtherFloor = markerFloor !== floor;
              return (
                <div
                  className={`map-monster-marker${isSelected ? " selected" : ""}${isOtherFloor ? " other-floor" : ""}`}
                  key={getMapMonsterPositionKey(category.id, positionIndex)}
                  style={{
                    left: `${(x / mapDimensions.width) * 100}%`,
                    top: `${(y / mapDimensions.height) * 100}%`,
                    transform: `translate(-50%, -50%) scale(${1 / zoom})`,
                  }}
                >
                  <button
                    aria-expanded={isSelected}
                    aria-label={`${displayName}, poziom ${markerFloor > 0 ? `+${markerFloor}` : markerFloor}, pozycja ${x} × ${y}${isOtherFloor ? ", inny poziom" : ""}`}
                    className="map-monster-icon-button"
                    onClick={() => selectMonsterPosition(category, positionIndex)}
                    title={displayName}
                    type="button"
                  >
                    <span aria-hidden="true" className="map-monster-dot" />
                  </button>
                  {isSelected && (
                    <div
                      aria-label={`Informacje o potworze ${displayName}`}
                      className="map-npc-popup map-monster-popup"
                      role="dialog"
                    >
                      <button
                        aria-label={`Zamknij informacje o potworze ${displayName}`}
                        className="map-house-popup-close"
                        onClick={() => {
                          setSelectedMonsterPositionKey(null);
                          setSearchMessage("");
                        }}
                        type="button"
                      >
                        ×
                      </button>
                      <div className="map-house-popup-heading">
                        <span aria-hidden="true" className="map-monster-popup-icon" />
                        <div>
                          <strong>{displayName}</strong>
                          <span className="map-monster-popup-floor">
                            Poziom{" "}
                            {markerFloor > 0 ? `+${markerFloor}` : markerFloor}
                          </span>
                        </div>
                      </div>
                      {category.name !== displayName && (
                        <p className="map-monster-popup-source">
                          {category.name}
                        </p>
                      )}
                      <p className="map-npc-popup-description">
                        {x} × {y}
                      </p>
                    </div>
                  )}
                </div>
              );
            });
          })}
          {houses
            .filter(
              (house) =>
                markerLayer === "houses" && house.position.floor === floor,
            )
            .map((house) => (
              <div
                className={`map-house-marker${
                  selectedHouseId === house.id ? " selected" : ""
                }`}
                key={house.id}
                style={{
                  left: `${(house.position.x / mapDimensions.width) * 100}%`,
                  top: `${(house.position.y / mapDimensions.height) * 100}%`,
                  transform: `translate(-50%, -50%) scale(${1 / zoom})`,
                }}
              >
                <button
                  aria-expanded={selectedHouseId === house.id}
                  aria-label={`${house.name}, domek w ${house.region}, poziom ${house.position.floor}`}
                  className="map-house-icon-button"
                  onClick={() => {
                    setMarkerLayer("houses");
                    setSelectedNpcId(null);
                    setSelectedPositionKey(null);
                    clearSelectedMonster();
                    setSelectedLocationId(null);
                    setSelectedHouseId(house.id);
                    setSearchValue(house.name);
                    setSearchMessage("");
                    focusPendingRef.current = true;
                    setFocusRequest((request) => request + 1);
                    setFloor(house.position.floor);
                  }}
                  title={house.name}
                  type="button"
                >
                  <MapHouseIcon />
                </button>
                {selectedHouseId === house.id && (
                  <div
                    aria-label={`Informacje o domku ${house.name}`}
                    className="map-house-popup"
                    role="dialog"
                  >
                    <button
                      aria-label="Zamknij informacje o domku"
                      className="map-house-popup-close"
                      onClick={() => setSelectedHouseId(null)}
                      type="button"
                    >
                      ×
                    </button>
                    <div className="map-house-popup-heading">
                      <MapHouseIcon />
                      <div>
                        <strong>{house.name}</strong>
                        <button
                          className="map-house-popup-floor"
                          onClick={() => setFloor(house.position.floor)}
                          type="button"
                        >
                          Poziom{" "}
                          {house.position.floor > 0
                            ? `+${house.position.floor}`
                            : house.position.floor}
                        </button>
                      </div>
                    </div>
                    <p>{house.region}</p>
                  </div>
                )}
              </div>
            ))}
          {locations
            .filter(
              (location) =>
                markerLayer === "locations" &&
                location.position.floor === floor,
            )
            .map((location) => (
              <button
                aria-label={`${location.name}, poziom ${location.position.floor}, pozycja ${location.position.x} × ${location.position.y}`}
                className={`map-location-marker${
                  selectedLocationId === location.id ? " selected" : ""
                }`}
                key={location.id}
                onClick={() => {
                  setMarkerLayer("locations");
                  setSelectedNpcId(null);
                  setSelectedPositionKey(null);
                  clearSelectedMonster();
                  setSelectedHouseId(null);
                  setSelectedLocationId(location.id);
                  setSearchValue(location.name);
                  focusPendingRef.current = true;
                  setFocusRequest((request) => request + 1);
                  setFloor(location.position.floor);
                  setSearchMessage(
                    `${location.name}: poziom ${location.position.floor}, pozycja ${location.position.x} × ${location.position.y}.`,
                  );
                }}
                style={{
                  left: `${(location.position.x / mapDimensions.width) * 100}%`,
                  top: `${(location.position.y / mapDimensions.height) * 100}%`,
                  transform: `translate(-50%, -50%) scale(${1 / zoom})`,
                }}
                title={
                  location.description
                    ? `${location.name}: ${location.description}`
                    : location.name
                }
                type="button"
              >
                <span className="map-location-label">{location.name}</span>
              </button>
            ))}
        </div>
        {imageError && (
          <p className="map-error" role="alert">
            Nie udało się wczytać obrazu poziomu {floor}. Sprawdź pliki mapy w
            folderze public/maps.
          </p>
        )}
        {!imageError &&
          selectedPosition &&
          selectedPosition.floor !== floor &&
          selectedNpc && (
          <p className="map-floor-note">
            {selectedNpc.name} znajduje się na poziomie{" "}
            {selectedPosition.floor}.
          </p>
          )}
      </div>
      <p className="map-help">
        Wybierz NPC, Potwory, Domki lub Lokalizacje, aby wyświetlić oznaczenia.
        Wyszukanie potwora pokazuje jego markery na wszystkich poziomach bez
        przesuwania mapy; szare oznaczają inne piętra. Kliknij marker, aby
        przejść na jego poziom i przybliżyć pozycję. Kliknij zielony znacznik
        NPC, aby zobaczyć jego opis, lub etykietę lokalizacji, aby wyświetlić
        pozycję.
        Kliknij niebieską ikonę domku, aby zobaczyć jego nazwę i lokalizację.
        Przeciągnij mapę, aby ją przesunąć. Użyj kółka myszy lub przycisków,
        aby zmienić powiększenie.
      </p>
    </section>
  );
}

export default App;
