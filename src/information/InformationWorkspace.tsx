import type { ReactNode } from "react";
import type { InformationCategory } from "./types";

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

export function InformationWorkspace({
  categories,
  onQueryChange,
  onSelect,
  query,
  selectedCategory,
  details,
}: {
  categories: InformationCategory[];
  onQueryChange: (query: string) => void;
  onSelect: (name: string) => void;
  query: string;
  selectedCategory?: InformationCategory;
  details?: ReactNode;
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
        {selectedCategory ? details : (
          <div className="empty-detail">Wybierz kategorię z listy.</div>
        )}
      </section>
    </section>
  );
}
