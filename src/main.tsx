import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import type { Monster } from "./types";
import "./styles.css";

function AppLoader() {
  const [monsters, setMonsters] = useState<Monster[]>();
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(new URL("./data/monsters.json", import.meta.url), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<Monster[]>;
      })
      .then(setMonsters)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Nie udało się załadować danych potworów.", error);
        setLoadError(true);
      });

    return () => controller.abort();
  }, [attempt]);

  if (loadError) {
    return (
      <main className="app-loader">
        <section className="app-loader-card">
          <div className="app-loader-brand">
            <span aria-hidden="true" className="app-loader-mark">A</span>
            <span>
              <strong>ApoWiki</strong>
              <small>ENCYKLOPEDIA SERWERA</small>
            </span>
          </div>
          <div className="app-loader-error" role="alert">
            <h1>Nie udało się wczytać danych</h1>
            <p>Sprawdź połączenie z internetem i spróbuj ponownie.</p>
          </div>
          <button
            className="app-loader-retry"
            onClick={() => {
              setLoadError(false);
              setAttempt((currentAttempt) => currentAttempt + 1);
            }}
            type="button"
          >
            Spróbuj ponownie
          </button>
        </section>
        <span className="app-loader-footer">BAZA WIEDZY · ŚWIAT APO</span>
      </main>
    );
  }

  if (!monsters) {
    return (
      <main className="app-loader">
        <section aria-labelledby="app-loader-title" className="app-loader-card">
          <div className="app-loader-brand">
            <span aria-hidden="true" className="app-loader-mark">A</span>
            <span>
              <strong>ApoWiki</strong>
              <small>ENCYKLOPEDIA SERWERA</small>
            </span>
          </div>
          <div className="app-loader-content">
            <p className="eyebrow">WITAJ W ŚWIECIE APO</p>
            <h1 id="app-loader-title">Przygotowujemy bazę wiedzy</h1>
            <p className="app-loader-description">
              Wczytujemy bestiariusz i przygotowujemy wszystko do drogi.
            </p>
          </div>
          <div aria-hidden="true" className="app-loader-progress">
            <span />
          </div>
          <p className="app-loader-status" role="status">
            Wczytywanie danych...
          </p>
        </section>
        <span className="app-loader-footer">BAZA WIEDZY · ŚWIAT APO</span>
      </main>
    );
  }

  return <App monsters={monsters} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppLoader />
  </React.StrictMode>,
);
