export type GlobalSearchResult = {
  id: string;
  kind:
    | "monster"
    | "item"
    | "boss"
    | "npc"
    | "monster-location"
    | "map-location"
    | "house"
    | "information"
    | "system"
    | "teleports";
  name: string;
  summary: string;
  searchText: string;
};

const resultLabels: Record<GlobalSearchResult["kind"], string> = {
  monster: "Potwór",
  item: "Przedmiot",
  boss: "Boss",
  npc: "NPC",
  "monster-location": "Lokalizacja potworów",
  "map-location": "Miejsce na mapie",
  house: "Dom",
  information: "Informacje",
  system: "System",
  teleports: "Teleporty",
};

const resultGroups: {
  id: string;
  label: string;
  kinds: GlobalSearchResult["kind"][];
}[] = [
  { id: "monsters", label: "Potwory", kinds: ["monster", "monster-location"] },
  { id: "bosses", label: "Bossy", kinds: ["boss"] },
  { id: "items", label: "Przedmioty", kinds: ["item"] },
  { id: "npcs", label: "NPC", kinds: ["npc"] },
  { id: "map-locations", label: "Miejsca na mapie", kinds: ["map-location"] },
  { id: "houses", label: "Domy", kinds: ["house"] },
  { id: "information", label: "Informacje", kinds: ["information"] },
  { id: "systems", label: "Systemy", kinds: ["system"] },
  { id: "teleports", label: "Teleporty", kinds: ["teleports"] },
];

export function GlobalSearchWorkspace({
  loading,
  onQueryChange,
  onRetry,
  onSelect,
  query,
  results,
  searchError,
}: {
  loading: boolean;
  onQueryChange: (query: string) => void;
  onRetry: () => void;
  onSelect: (result: GlobalSearchResult) => void;
  query: string;
  results: GlobalSearchResult[];
  searchError: string;
}) {
  const groupedResults = resultGroups
    .map((group) => ({
      ...group,
      results: results.filter((result) => group.kinds.includes(result.kind)),
    }))
    .filter((group) => group.results.length > 0);

  return (
    <section className="global-search">
      <div className="global-search-heading">
        <p className="eyebrow">JEDNA WYSZUKIWARKA · CAŁA BAZA WIEDZY</p>
        <h2>Szukaj w ApoWiki</h2>
        <p>
          Znajdź potwory, łupy, NPC, lokalizacje, bossów i informacje o świecie.
        </p>
      </div>

      <label className="global-search-box">
        <span aria-hidden="true">⌕</span>
        <input
          aria-label="Szukaj we wszystkich danych"
          autoFocus
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Np. Returned, Old Wizard, Dragon Scale..."
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

      {searchError && (
        <div className="global-search-error" role="alert">
          <span>{searchError}</span>
          <button onClick={onRetry} type="button">Spróbuj ponownie</button>
        </div>
      )}
      {loading && (
        <p className="global-search-status" role="status">
          Ładowanie lokalizacji potworów...
        </p>
      )}

      {query.trim() ? (
        <section className="global-search-results" aria-live="polite">
          <div className="global-search-results-heading">
            <h3>Wyniki wyszukiwania</h3>
            <span>{results.length}</span>
          </div>
          {results.length > 0 ? (
            <div className="global-search-groups">
              {groupedResults.map((group) => (
                <section
                  aria-labelledby={`global-search-group-${group.id}`}
                  className="global-search-group"
                  key={group.id}
                >
                  <div className="global-search-group-heading">
                    <h4 id={`global-search-group-${group.id}`}>{group.label}</h4>
                    <span>{group.results.length}</span>
                  </div>
                  <div className="global-search-list">
                    {group.results.map((result) => (
                      <button
                        className="global-search-result"
                        key={result.id}
                        onClick={() => onSelect(result)}
                        type="button"
                      >
                        <span className="global-search-result-type">
                          {resultLabels[result.kind]}
                        </span>
                        <strong>{result.name}</strong>
                        <span className="global-search-result-summary">
                          {result.summary}
                        </span>
                        <span aria-hidden="true" className="global-search-result-chevron">↗</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : !loading && !searchError ? (
            <div className="global-search-empty">
              <span aria-hidden="true">⌕</span>
              <strong>Brak wyników</strong>
              <p>Spróbuj innej nazwy lub fragmentu opisu.</p>
            </div>
          ) : null}
        </section>
      ) : (
        <div className="global-search-hints">
          <span>Szukaj m.in. po:</span>
          <strong>nazwach</strong>
          <strong>opisach</strong>
          <strong>loocie i jego źródłach</strong>
          <strong>lokalizacjach</strong>
        </div>
      )}
    </section>
  );
}
