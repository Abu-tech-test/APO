import { useState } from "react";
import { Graphic } from "../components/Graphic";
import type { Item, Monster } from "../types";
import type { InformationCategory } from "../information/types";
import type { MapNpcLocation, NPC } from "../map/mapData";
import { monsters } from "../map/mapData";
import type { Boss } from "./types";
import {
  compareLootFrequency,
  formatLootAmount,
  formatNumber,
  getBossRegionLabel,
  getItemCategoryLabel,
  getItemImage,
  getMonsterImage,
} from "./utils";

export function InformationDetails({
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
                image={`./images/items/${category.trivia.clientId}.webp`}
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

export function MonsterDetails({
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
        {mapPositionCount > 0 ? (
          <button
            aria-label={`Pokaż ${mapPositionCount} lokalizacji potwora ${monster.name} na mapie`}
            className="stat-card map-stat-card"
            onClick={() => onShowOnMap(monster)}
            type="button"
          >
            <span className="stat-symbol map-symbol" aria-hidden="true">
              ⌖
            </span>
            <span className="stat-label">Lokalizacja na mapie</span>
            <strong>{formatNumber(mapPositionCount)}</strong>
            <small>LOKALIZACJI</small>
          </button>
        ) : (
          <div className="stat-card map-stat-card">
            <span className="stat-symbol map-symbol" aria-hidden="true">
              ⌖
            </span>
            <span className="stat-label">Lokalizacja na mapie</span>
            <strong>—</strong>
            <small>BRAK LOKALIZACJI</small>
          </div>
        )}
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

export function ItemDetails({
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

export function BossDetails({
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

export function NPCDetails({
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
            decoding="async"
            loading="lazy"
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
