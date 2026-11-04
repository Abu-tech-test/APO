import { useEffect, useMemo, useState } from "react";
import bossData from "./data/bosses.json";
import graphics from "./data/graphics.json";
import monsterData from "./data/monsters.json";
import npcData from "./data/npcs.json";
import type { Item, Monster } from "./types";

const monsters: Monster[] = monsterData;
type NPC = {
  id: number;
  name: string;
  region: string;
  category: string;
  location: string;
  profession?: string | null;
  description: string;
  image: string;
};
const npcs: NPC[] = npcData;
type BossRegionData = {
  name: string;
  bosses: {
    name: string;
    lookType: number;
    outfitColors: { head: number; body: number; legs: number; feet: number };
    description: string;
    image?: string;
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
  Zawsze: 0,
  "Bardzo czesto": 1,
  Czesto: 2,
  Srednio: 3,
  Rzadko: 4,
  "Bardzo rzadko": 5,
  "Niespotykanie rzadko": 6,
};

type Section = "monsters" | "items" | "bosses" | "npcs";
type CatalogEntry =
  | { section: "monsters"; name: string; caption: string; monster: Monster }
  | { section: "items"; name: string; caption: string; item: Item }
  | { section: "bosses"; name: string; caption: string; boss: Boss }
  | { section: "npcs"; name: string; caption: string; npc: NPC };

function formatNumber(value: number) {
  return new Intl.NumberFormat("pl-PL").format(value);
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
  const [section, setSection] = useState<Section>("monsters");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedMonster, setSelectedMonster] = useState<Monster>(monsters[0]);
  const [selectedItemName, setSelectedItemName] = useState("");
  const [selectedBossRegion, setSelectedBossRegion] = useState(bossRegions[0].name);
  const [selectedBoss, setSelectedBoss] = useState<Boss>(bosses[0]);
  const [selectedNpcRegion, setSelectedNpcRegion] = useState("MAIN");
  const [selectedNpcCategory, setSelectedNpcCategory] = useState("all");
  const [selectedNpc, setSelectedNpc] = useState<NPC>();

  const items = useMemo<Item[]>(() => {
    const itemMap = new Map<string, Item>();

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

    return [...itemMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "pl", { sensitivity: "base" }),
    );
  }, []);

  const selectedItem =
    items.find(
      (item) => item.name.toLocaleLowerCase("pl") === selectedItemName,
    ) ?? items[0];
  const npcCategories = useMemo(
    () =>
      [...new Set(
        npcs
          .filter((npc) => npc.region === selectedNpcRegion)
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
        ? items.map((item) => ({
            section: "items",
            name: item.name,
            caption: `${item.drops.length} źródeł`,
            item,
          }))
        : section === "bosses"
        ? bosses
            .filter((boss) => boss.region === selectedBossRegion)
            .map((boss) => ({
              section: "bosses",
              name: boss.name,
              caption: getBossRegionLabel(boss.region),
              boss,
            }))
        : npcs
            .filter(
              (npc) =>
                npc.region === selectedNpcRegion &&
                (selectedNpcCategory === "all" ||
                  npc.category === selectedNpcCategory),
            )
            .map((npc) => ({
              section: "npcs",
              name: npc.name,
              caption: npc.category,
              npc,
            })),
    [items, npcs, section, selectedBossRegion, selectedNpcRegion, selectedNpcCategory],
  );
  const filteredList = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pl");
    if (!normalizedQuery) return sourceList;

    return sourceList.filter((entry) =>
      entry.name.toLocaleLowerCase("pl").includes(normalizedQuery),
    );
  }, [query, sourceList]);
  const pageCount = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const visibleEntries = filteredList.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  useEffect(() => {
    setPage(1);
  }, [section, query, selectedBossRegion, selectedNpcRegion, selectedNpcCategory]);

  useEffect(() => {
    if (section === "monsters") {
      const currentSelectionVisible = filteredList.some(
        (entry) =>
          entry.section === "monsters" &&
          entry.monster.id === selectedMonster.id,
      );
      const firstMonster = filteredList[0];
      if (!currentSelectionVisible && firstMonster?.section === "monsters") {
        setSelectedMonster(firstMonster.monster);
      }
    } else if (section === "items") {
      const currentSelectionVisible = filteredList.some(
        (entry) =>
          entry.section === "items" && entry.item.name === selectedItem?.name,
      );
      const firstItem = filteredList[0];
      if (!currentSelectionVisible && firstItem?.section === "items") {
        setSelectedItemName(firstItem.item.name.toLocaleLowerCase("pl"));
      }
    } else if (section === "bosses") {
      const currentSelectionVisible = filteredList.some(
        (entry) =>
          entry.section === "bosses" &&
          entry.boss.region === selectedBossRegion &&
          entry.boss.name === selectedBoss.name,
      );
      const firstBoss = filteredList[0];
      if (!currentSelectionVisible && firstBoss?.section === "bosses") {
        setSelectedBoss(firstBoss.boss);
      }
    } else {
      const currentSelectionVisible = filteredList.some(
        (entry) =>
          entry.section === "npcs" && entry.npc.id === selectedNpc?.id,
      );
      const firstNpc = filteredList[0];
      if (!currentSelectionVisible && firstNpc?.section === "npcs") {
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
    setSection(nextSection);
    setQuery("");
  }

  function openMonster(monster: Monster) {
    setSelectedMonster(monster);
    setSection("monsters");
    setQuery("");
  }

  function openItem(name: string) {
    setSelectedItemName(name.toLocaleLowerCase("pl"));
    setSection("items");
    setQuery("");
  }

  const selectedBossLootMonster = monsters.find(
    (monster) =>
      monster.name.toLocaleLowerCase("pl") === selectedBoss.name.toLocaleLowerCase("pl") &&
      monster.loot.length > 0,
  );

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
            Bestiariusz i przedmioty — sprawdź, co kryje świat gry.
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
      </nav>

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
                {bossRegions.map((region) => (
                  <option key={region.name} value={region.name}>
                    {getBossRegionLabel(region.name)}
                  </option>
                ))}
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
                        ? getItemImage(entry.name)
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
              monster={selectedMonster}
              onOpenItem={openItem}
            />
          ) : section === "items" && selectedItem ? (
            <ItemDetails
              image={getItemImage(selectedItem.name)}
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
            <NPCDetails image={selectedNpc.image} npc={selectedNpc} />
          ) : (
            <div className="empty-detail">
              {section === "items" ? "Wybierz przedmiot z listy." : section === "npcs" ? "Wybierz NPC z listy." : "Wybierz bossa z listy."}
            </div>
          )}
        </section>
      </section>

      <footer className="footer">
        <span>ApoWiki <span className="footer-divider">/</span> Wiedza o serwerze w jednym miejscu</span>
        <span>Dane gry <span className="footer-dot">•</span> Bestiariusz</span>
      </footer>
    </main>
  );
}

function MonsterDetails({
  image,
  monster,
  onOpenItem,
}: {
  image?: string;
  monster: Monster;
  onOpenItem: (name: string) => void;
}) {
  const sortedLoot = [...monster.loot].sort(
    (a, b) =>
      (lootFrequencyOrder[a.frequency] ?? Number.MAX_SAFE_INTEGER) -
      (lootFrequencyOrder[b.frequency] ?? Number.MAX_SAFE_INTEGER),
  );

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
            <span className="loot-amount">× {formatNumber(loot.amount)}</span>
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
          <p className="detail-caption">Potwory, z których można zdobyć ten przedmiot</p>
        </div>
        <span className="data-badge item-badge">PRZEDMIOT</span>
      </div>

      <div className="item-summary">
        <span className="summary-icon">⌖</span>
        <div>
          <strong>Znane źródła</strong>
          <p>
            Ten przedmiot może wypaść z{" "}
            <strong>{formatNumber(item.drops.length)} {item.drops.length === 1 ? "potwora" : "potworów"}</strong>.
          </p>
        </div>
      </div>

      <div className="section-heading">
        <div>
          <p className="eyebrow">BESTIARIUSZ</p>
          <h3>Wypada z <span>{item.drops.length}</span></h3>
        </div>
        <span className="heading-note">Kliknij potwora, aby zobaczyć jego kartę</span>
      </div>

      <div className="source-list">
        {item.drops.map(({ monster, loot }) => (
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
              <strong>{loot.frequency}</strong>
              <small>Ilość: {formatNumber(loot.amount)}</small>
            </span>
            <span aria-hidden="true" className="row-chevron">↗</span>
          </button>
        ))}
      </div>
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
      {lootMonster && (
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
      )}
    </article>
  );
}

function NPCDetails({ image, npc }: { image?: string; npc: NPC }) {
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

      <section className="boss-description npc-description">
        <p className="eyebrow">OPIS</p>
        <p>{npc.description}</p>
      </section>
    </article>
  );
}

export default App;
