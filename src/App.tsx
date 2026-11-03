import { useEffect, useMemo, useState } from "react";
import graphics from "./data/graphics.json";
import monsterData from "./data/monsters.json";
import type { Item, Monster } from "./types";

const monsters: Monster[] = monsterData;
const graphicsByName: {
  monsters: Record<string, string>;
  items: Record<string, string>;
} = graphics;
const pageSize = 10;

type Section = "monsters" | "items";
type CatalogEntry =
  | { section: "monsters"; name: string; caption: string; monster: Monster }
  | { section: "items"; name: string; caption: string; item: Item };

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

function getMonsterImage(name: string) {
  return graphicsByName.monsters[name];
}

function getItemImage(name: string) {
  return graphicsByName.items[name.toLocaleLowerCase("pl")];
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
  const sourceList = useMemo<CatalogEntry[]>(
    () =>
      section === "monsters"
        ? monsters.map((monster) => ({
            section: "monsters",
            name: monster.name,
            caption: `${formatNumber(monster.hp)} HP`,
            monster,
          }))
        : items.map((item) => ({
            section: "items",
            name: item.name,
            caption: `${item.drops.length} źródeł`,
            item,
          })),
    [items, section],
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
  }, [section, query]);

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
    } else {
      const currentSelectionVisible = filteredList.some(
        (entry) =>
          entry.section === "items" && entry.item.name === selectedItem?.name,
      );
      const firstItem = filteredList[0];
      if (!currentSelectionVisible && firstItem?.section === "items") {
        setSelectedItemName(firstItem.item.name.toLocaleLowerCase("pl"));
      }
    }
  }, [filteredList, section, selectedItem?.name, selectedMonster.id]);

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
      </nav>

      <section className="workspace">
        <aside className="catalog">
          <div className="catalog-heading">
            <div>
              <p className="eyebrow">{section === "monsters" ? "BESTIARIUSZ" : "KOLEKCJA"}</p>
              <h2>{section === "monsters" ? "Potwory" : "Przedmioty"}</h2>
            </div>
            <span className="result-count">{filteredList.length}</span>
          </div>
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label={`Szukaj ${section === "monsters" ? "potwora" : "przedmiotu"}`}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Szukaj ${section === "monsters" ? "potwora" : "przedmiotu"}...`}
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
                  : selectedItem?.name === entry.name;

              return (
                <button
                  aria-current={isSelected ? "true" : undefined}
                  className={isSelected ? "entry selected" : "entry"}
                  key={entry.section === "monsters" ? entry.monster.id : entry.name}
                  onClick={() =>
                    entry.section === "monsters"
                      ? setSelectedMonster(entry.monster)
                      : setSelectedItemName(entry.item.name.toLocaleLowerCase("pl"))
                  }
                  type="button"
                >
                  <Graphic
                    className={`entry-icon ${entry.section === "monsters" ? "creature-icon" : "item-icon"}`}
                    image={
                      entry.section === "monsters"
                        ? getMonsterImage(entry.name)
                        : getItemImage(entry.name)
                    }
                    name={entry.name}
                  />
                  <span className="entry-text">
                    <strong>{entry.name}</strong>
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
              image={getMonsterImage(selectedMonster.name)}
              monster={selectedMonster}
              onOpenItem={openItem}
            />
          ) : selectedItem ? (
            <ItemDetails
              image={getItemImage(selectedItem.name)}
              item={selectedItem}
              onOpenMonster={openMonster}
            />
          ) : (
            <div className="empty-detail">Wybierz przedmiot z listy.</div>
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
        {monster.loot.map((loot) => (
          <button
            className="loot-row"
            key={`${loot.name}-${loot.frequency}`}
            onClick={() => onOpenItem(loot.name)}
            type="button"
          >
            <Graphic
              className="loot-icon item-icon"
              image={getItemImage(loot.name)}
              name={loot.name}
            />
            <span className="loot-name">{loot.name}</span>
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
          <h2>{item.name}</h2>
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
              image={getMonsterImage(monster.name)}
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

export default App;
