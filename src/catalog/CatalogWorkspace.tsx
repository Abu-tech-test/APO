import { Graphic } from "../components/Graphic";
import { BossDetails, ItemDetails, MonsterDetails, NPCDetails } from "./Details";
import type { NPC } from "../map/mapData";
import type { Item, Monster } from "../types";
import {
  getBossImage,
  getBossRegionLabel,
  getCatalogItemImage,
  getMonsterImage,
} from "./utils";
import type { Boss, BossRegionData, CatalogEntry, ZoneFilter } from "./types";

export default function CatalogWorkspace({
  section,
  bossRegions,
  selectedBossRegion,
  setSelectedBossRegion,
  query,
  setQuery,
  selectedItemZone,
  setSelectedItemZone,
  selectedNpcRegion,
  setSelectedNpcRegion,
  selectedNpcCategory,
  setSelectedNpcCategory,
  npcCategories,
  filteredList,
  visibleEntries,
  selectedMonster,
  selectedItem,
  selectedBoss,
  selectedNpc,
  selectCatalogEntry,
  page,
  pageCount,
  navigateToPage,
  monsterMapPositionCounts,
  showMonsterOnMap,
  openItem,
  openMonster,
  showNpcOnMap,
  selectedBossLootMonster,
}: {
  section: "monsters" | "items" | "bosses" | "npcs";
  bossRegions: BossRegionData[];
  selectedBossRegion: string;
  setSelectedBossRegion: (value: string) => void;
  query: string;
  setQuery: (value: string) => void;
  selectedItemZone: ZoneFilter;
  setSelectedItemZone: (value: ZoneFilter) => void;
  selectedNpcRegion: string;
  setSelectedNpcRegion: (value: string) => void;
  selectedNpcCategory: string;
  setSelectedNpcCategory: (value: string) => void;
  npcCategories: string[];
  filteredList: CatalogEntry[];
  visibleEntries: CatalogEntry[];
  selectedMonster: Monster;
  selectedItem?: Item;
  selectedBoss: Boss;
  selectedNpc?: NPC;
  selectCatalogEntry: (entry: CatalogEntry) => void;
  page: number;
  pageCount: number;
  navigateToPage: (page: number) => void;
  monsterMapPositionCounts: Map<number, number>;
  showMonsterOnMap: (monster: Monster) => void;
  openItem: (name: string) => void;
  openMonster: (monster: Monster) => void;
  showNpcOnMap: (npc: NPC, position: { floor: number; x: number; y: number }) => void;
  selectedBossLootMonster?: Monster;
}) {
  return (
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
                  onClick={() => selectCatalogEntry(entry)}
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
              onClick={() => navigateToPage(page - 1)}
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
              onClick={() => navigateToPage(page + 1)}
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

  );
}
