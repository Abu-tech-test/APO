import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  defaultMapZoom,
  getMapMonsterPositionKey,
  getMapPositionKey,
  mapDimensions,
  mapFloors,
  maxMapZoom,
  monsters,
} from "./mapData";
import type {
  MapHouse,
  MapLocation,
  MapMarkerLayer,
  MapMonsterMapRequest,
  MapNpcMapRequest,
  MapNpcPosition,
  MonsterMapCategory,
  NPC,
} from "./mapData";

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
  onSelectMonsterPosition,
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
  onSelectMonsterPosition: (request: MapMonsterMapRequest) => void;
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
  const [selectedMonsterCategoryId, setSelectedMonsterCategoryId] = useState<
    number | null
  >(null);
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
  const previousMonsterMapRequestRef = useRef(monsterMapRequest);
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
      : selectedMonsterCategoryId !== null
        ? monsterMapCategories.filter(
            (category) => category.id === selectedMonsterCategoryId,
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
  const selectedMonsterCategory =
    selectedMonsterPosition === undefined
      ? undefined
      : monsterMapCategories.find(
          (category) => category.id === selectedMonsterPosition.categoryId,
        );
  const selectedMonster =
    selectedMonsterCategory?.monsterIds.length
      ? monsters.find(
          (monster) => monster.id === selectedMonsterCategory.monsterIds[0],
        )
      : undefined;
  const selectedHouse =
    selectedHouseId === null
      ? undefined
      : houses.find((house) => house.id === selectedHouseId);
  const selectedPopupPosition =
    selectedPosition ??
    selectedMonsterPosition?.position ??
    selectedHouse?.position;
  const selectedLocation =
    selectedLocationId === null
      ? undefined
      : locations.find((location) => location.id === selectedLocationId);
  const imageName =
    floor === 0 ? "level_0.png" : `level_${floor > 0 ? `+${floor}` : floor}.png`;

  function getPopupPlacement(position: { x: number; y: number }): {
    style: CSSProperties;
    below: boolean;
    maxHeight: number;
  } {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) {
      return {
        style: { left: "50%", top: 16 },
        below: true,
        maxHeight: 240,
      };
    }

    const markerX =
      (viewport.clientWidth - canvas.clientWidth) / 2 +
      pan.x +
      (position.x / mapDimensions.width) * canvas.clientWidth * zoom;
    const markerY =
      (viewport.clientHeight - canvas.clientHeight) / 2 +
      pan.y +
      (position.y / mapDimensions.height) * canvas.clientHeight * zoom;
    const anchorY = Math.max(
      8,
      Math.min(viewport.clientHeight - 8, markerY),
    );
    const halfPopupWidth = Math.min(133, viewport.clientWidth / 2 - 8);
    const left = Math.max(
      halfPopupWidth + 8,
      Math.min(viewport.clientWidth - halfPopupWidth - 8, markerX),
    );
    const aboveSpace = anchorY - 18;
    const belowSpace = viewport.clientHeight - anchorY - 18;
    const below = aboveSpace < 140 && belowSpace > aboveSpace;

    return {
      style: {
        left,
        ...(below
          ? { top: anchorY + 18 }
          : { bottom: viewport.clientHeight - anchorY + 18 }),
      },
      below,
      maxHeight: Math.max(48, (below ? belowSpace : aboveSpace) - 28),
    };
  }

  const popupPlacement = selectedPopupPosition
    ? getPopupPlacement(selectedPopupPosition)
    : undefined;

  function clearSelectedMonster() {
    setSelectedMonsterId(null);
    setSelectedMonsterCategoryId(null);
    setSelectedMonsterPositionKey(null);
  }

  function selectMonsterPosition(
    category: MonsterMapCategory,
    positionIndex: number,
    updateNavigation = true,
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
    setSelectedMonsterCategoryId(
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
    if (updateNavigation) {
      onSelectMonsterPosition({
        monsterId: categoryMonsterId,
        marker: {
          categoryId: category.id,
          positionIndex,
          floor: targetFloor,
          x,
          y,
        },
      });
    }
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
    setSelectedMonsterCategoryId(null);
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
    if (previousMonsterMapRequestRef.current && !monsterMapRequest) {
      setSelectedMonsterPositionKey(null);
      focusPendingRef.current = false;
    }
    previousMonsterMapRequestRef.current = monsterMapRequest;
  }, [monsterMapRequest]);

  useEffect(() => {
    if (!monsterMapRequest) return;
    if (monsterMapLoadStatus !== "ready") return;
    if (monsterMapRequest.marker) {
      const { categoryId, positionIndex, floor, x, y } =
        monsterMapRequest.marker;
      const category = monsterMapCategories.find(
        (entry) => entry.id === categoryId,
      );
      const marker = category?.positions[positionIndex];
      if (
        !category ||
        !marker ||
        marker[0] !== floor ||
        marker[1] !== x ||
        marker[2] !== y
      ) {
        setSearchMessage("Nie znaleziono wskazanego markera potwora na mapie.");
        if (monsterMapRequest.monsterId !== undefined) {
          showMonsterLocations(monsterMapRequest.monsterId);
        }
        return;
      }

      selectMonsterPosition(category, positionIndex, false);
      return;
    }

    if (monsterMapRequest.monsterId === undefined) {
      setSearchMessage("Nie znaleziono potwora do pokazania na mapie.");
      return;
    }
    const monsterId = monsterMapRequest.monsterId;
    const category = monsterMapCategories.find(
      (entry) =>
        entry.monsterIds.includes(monsterId) &&
        entry.positions.length > 0,
    );
    if (!category) {
      setSearchMessage("Nie znaleziono lokalizacji tego potwora na mapie.");
      return;
    }

    showMonsterLocations(monsterId);
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
      const sourceCategory = monsterMapCategories.find(
        (entry) =>
          entry.monsterIds.length === 0 &&
          entry.name.toLocaleLowerCase("pl") === normalizedName,
      );
      if (sourceCategory) {
        setMarkerLayer("monsters");
        setSelectedNpcId(null);
        setSelectedPositionKey(null);
        setSelectedHouseId(null);
        setSelectedLocationId(null);
        setSelectedMonsterId(null);
        setSelectedMonsterCategoryId(sourceCategory.id);
        setSelectedMonsterPositionKey(null);
        setSearchValue(sourceCategory.name);
        setSearchMessage(
          `Pokazano ${sourceCategory.positions.length} lokalizacji: ${sourceCategory.name}. Kliknij marker, aby przejść do poziomu i przybliżyć pozycję.`,
        );
        return;
      }

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

      setSearchMessage(
        monster
          ? `Brak lokalizacji potwora ${monster.name} na mapie.`
          : `Nie znaleziono potwora „${searchValue.trim()}”.`,
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
      (event.target as HTMLElement).closest("button, .map-popup-overlay")
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
        {popupPlacement && (
          <div className="map-popup-overlay">
            <div
              aria-label={
                selectedNpc
                  ? `Informacje o NPC ${selectedNpc.name}`
                  : selectedMonsterCategory
                    ? `Informacje o potworze ${selectedMonster?.name ?? selectedMonsterCategory.name}`
                    : `Informacje o domku ${selectedHouse?.name ?? ""}`
              }
              className={`map-npc-popup${selectedMonsterCategory ? " map-monster-popup" : ""}${popupPlacement.below ? " map-popup-below" : ""}`}
              role="dialog"
              style={popupPlacement.style}
            >
              <button
                aria-label={
                  selectedNpc
                    ? `Zamknij informacje o NPC ${selectedNpc.name}`
                    : selectedMonsterCategory
                      ? `Zamknij informacje o potworze ${selectedMonster?.name ?? selectedMonsterCategory.name}`
                      : "Zamknij informacje o domku"
                }
                className="map-house-popup-close"
                onClick={() => {
                  if (selectedNpc) {
                    setSelectedNpcId(null);
                    setSelectedPositionKey(null);
                  } else if (selectedMonsterCategory) {
                    setSelectedMonsterPositionKey(null);
                  } else {
                    setSelectedHouseId(null);
                  }
                  setSearchMessage("");
                }}
                type="button"
              >
                ×
              </button>
              <div
                className="map-popup-content"
                style={{ maxHeight: popupPlacement.maxHeight }}
              >
                {selectedNpc && selectedPosition ? (
                  <>
                    <div className="map-house-popup-heading">
                      <MapNpcIcon />
                      <div>
                        <strong>{selectedNpc.name}</strong>
                        <button
                          className="map-house-popup-floor"
                          onClick={() => setFloor(selectedPosition.floor)}
                          type="button"
                        >
                          Poziom{" "}
                          {selectedPosition.floor > 0
                            ? `+${selectedPosition.floor}`
                            : selectedPosition.floor}
                        </button>
                      </div>
                    </div>
                    <p className="map-npc-popup-description">
                      {selectedNpc.description}
                    </p>
                  </>
                ) : selectedMonsterCategory && selectedMonsterPosition ? (
                  <>
                    <div className="map-house-popup-heading">
                      <span
                        aria-hidden="true"
                        className="map-monster-popup-icon"
                      />
                      <div>
                        <strong>
                          {selectedMonster?.name ?? selectedMonsterCategory.name}
                        </strong>
                        <span className="map-monster-popup-floor">
                          Poziom{" "}
                          {selectedMonsterPosition.position.floor > 0
                            ? `+${selectedMonsterPosition.position.floor}`
                            : selectedMonsterPosition.position.floor}
                        </span>
                      </div>
                    </div>
                    {selectedMonsterCategory.name !==
                      (selectedMonster?.name ?? selectedMonsterCategory.name) && (
                      <p className="map-monster-popup-source">
                        {selectedMonsterCategory.name}
                      </p>
                    )}
                    <p className="map-npc-popup-description">
                      {selectedMonsterPosition.position.x} ×{" "}
                      {selectedMonsterPosition.position.y}
                    </p>
                  </>
                ) : selectedHouse ? (
                  <>
                    <div className="map-house-popup-heading">
                      <MapHouseIcon />
                      <div>
                        <strong>{selectedHouse.name}</strong>
                        <button
                          className="map-house-popup-floor"
                          onClick={() => setFloor(selectedHouse.position.floor)}
                          type="button"
                        >
                          Poziom{" "}
                          {selectedHouse.position.floor > 0
                            ? `+${selectedHouse.position.floor}`
                            : selectedHouse.position.floor}
                        </button>
                      </div>
                    </div>
                    <p>{selectedHouse.region}</p>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}
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


export default MapWorkspace;
