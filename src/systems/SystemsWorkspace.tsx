import type { GameSystem } from "./types";

export function SystemsWorkspace({
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

