import { useState } from "react";
import questData from "../data/quests.json";

type QuestTextSegment = {
  type: "text";
  text: string;
  strong?: boolean;
  strike?: boolean;
};

type QuestLinkSegment = {
  type: "link";
  text: string;
  url: string;
};

type QuestInlineImageSegment = {
  type: "image";
  alt: string;
  src: string;
};

type QuestParagraph = {
  type: "paragraph";
  align?: "center";
  segments: (QuestTextSegment | QuestLinkSegment | QuestInlineImageSegment)[];
};

type QuestImage = {
  type: "image";
  alt: string;
  size?: "icon";
  src: string;
};

type QuestImageRow = {
  type: "image-row";
  images: QuestImage[];
};

type QuestQuote = {
  type: "quote";
  lines: (string | QuestParagraph["segments"])[];
};

type QuestSpoiler = {
  type: "spoiler";
  title?: string;
  blocks: QuestBlock[];
};

type QuestOrderedListItem = {
  blocks: QuestBlock[];
};

type QuestOrderedList = {
  type: "ordered-list";
  items: QuestOrderedListItem[];
};

type QuestTable = {
  type: "table";
  fit?: boolean;
  headers: QuestParagraph["segments"][];
  rows: QuestParagraph["segments"][][];
};

type QuestBlock =
  | QuestParagraph
  | QuestImage
  | QuestQuote
  | QuestSpoiler
  | QuestOrderedList
  | QuestTable
  | QuestImageRow;

type QuestList = {
  type: "list";
  items: QuestParagraph[];
};

type QuestRenderBlock = QuestBlock | QuestList;

type QuestGuide = {
  id: string;
  title: string;
  author: string;
  blocks: QuestBlock[];
};

const questGuides = questData as QuestGuide[];
const listMarker = /^\s*[-*•]\s+/;

function asListItem(paragraph: QuestParagraph): QuestParagraph | null {
  const markerIndex = paragraph.segments.findIndex(
    (segment) => segment.type === "text" && segment.text.trim().length > 0,
  );
  if (markerIndex === -1) return null;

  const markerSegment = paragraph.segments[markerIndex];
  if (markerSegment.type !== "text") return null;

  const markerMatch = markerSegment.text.match(listMarker);
  if (!markerMatch) return null;

  const segments = paragraph.segments.flatMap((segment, index) => {
    if (index === markerIndex && segment.type === "text") {
      const text = segment.text.slice(markerMatch[0].length);
      return text ? [{ ...segment, text }] : [];
    }

    return segment.type !== "text" || segment.text.length > 0 ? [segment] : [];
  });

  return { type: "paragraph", segments };
}

function getQuestRenderBlocks(blocks: QuestBlock[]): QuestRenderBlock[] {
  const renderBlocks: QuestRenderBlock[] = [];

  const appendParagraph = (paragraph: QuestParagraph) => {
    const item = asListItem(paragraph);
    if (!item) {
      renderBlocks.push(paragraph);
      return;
    }

    const lastBlock = renderBlocks[renderBlocks.length - 1];
    if (lastBlock?.type === "list") {
      lastBlock.items.push(item);
    } else {
      renderBlocks.push({ type: "list", items: [item] });
    }
  };

  for (const block of blocks) {
    if (
      block.type === "paragraph" &&
      block.segments.length === 1 &&
      block.segments[0].type === "text" &&
      block.segments[0].text.includes("\n") &&
      block.segments[0].text.split(/\r?\n/).some((line) => listMarker.test(line))
    ) {
      for (const line of block.segments[0].text.split(/\r?\n/)) {
        if (line.length > 0) {
          appendParagraph({
            type: "paragraph",
            segments: [{ type: "text", text: line }],
          });
        }
      }
    } else if (block.type === "paragraph") {
      appendParagraph(block);
    } else {
      renderBlocks.push(block);
    }
  }

  return renderBlocks;
}

function renderQuestSegments(segments: QuestParagraph["segments"]) {
  return segments.map((segment, segmentIndex) => {
    if (segment.type === "link") {
      return (
        <a
          href={segment.url}
          key={segmentIndex}
          rel="noreferrer"
          target="_blank"
        >
          {segment.text}
        </a>
      );
    }

    if (segment.type === "image") {
      return (
        <img
          alt={segment.alt}
          className="quest-inline-image"
          decoding="async"
          key={segmentIndex}
          loading="lazy"
          src={segment.src}
        />
      );
    }

    const text = segment.strike ? <s>{segment.text}</s> : segment.text;
    return segment.strong ? (
      <strong key={segmentIndex}>{text}</strong>
    ) : (
      <span key={segmentIndex}>{text}</span>
    );
  });
}

function renderQuestBlocks(blocks: QuestBlock[], keyPrefix: string) {
  return getQuestRenderBlocks(blocks).map((block, blockIndex) => {
    const key = `${keyPrefix}-${blockIndex}`;

    if (block.type === "list") {
      return (
        <ul className="quest-list" key={key}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderQuestSegments(item.segments)}</li>
          ))}
        </ul>
      );
    }

    if (block.type === "ordered-list") {
      return (
        <ol className="quest-ordered-list" key={key}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>
              {renderQuestBlocks(item.blocks, `${key}-${itemIndex}`)}
            </li>
          ))}
        </ol>
      );
    }

    if (block.type === "image-row") {
      return (
        <div className="quest-image-row" key={key}>
          {block.images.map((image, imageIndex) => (
            <figure className="quest-image-row-item" key={imageIndex}>
              <img
                alt={image.alt}
                decoding="async"
                loading="lazy"
                src={image.src}
              />
            </figure>
          ))}
        </div>
      );
    }

    if (block.type === "table") {
      return (
        <div
          className={`quest-table-scroll${block.fit ? " quest-table-fit" : ""}`}
          key={key}
        >
          <table className="quest-table">
            <thead>
              <tr>
                {block.headers.map((header, headerIndex) => (
                  <th key={headerIndex} scope="col">
                    {renderQuestSegments(header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{renderQuestSegments(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (block.type === "spoiler") {
      return (
        <details className="quest-spoiler" key={key}>
          <summary>
            <span className="quest-spoiler-show">
              Show spoiler{block.title ? `: ${block.title}` : ""}
            </span>
            <span className="quest-spoiler-hide">
              Hide spoiler{block.title ? `: ${block.title}` : ""}
            </span>
          </summary>
          <div className="quest-spoiler-content">
            {renderQuestBlocks(block.blocks, key)}
          </div>
        </details>
      );
    }

    if (block.type === "image") {
      return (
        <figure
          className={`quest-image${block.size === "icon" ? " quest-image-icon" : ""}`}
          key={key}
        >
          <img
            alt={block.alt}
            decoding="async"
            loading="lazy"
            src={block.src}
          />
        </figure>
      );
    }

    if (block.type === "quote") {
      return (
        <blockquote className="quest-quote" key={key}>
          {block.lines.map((line, lineIndex) => {
            if (typeof line !== "string") {
              return (
                <p className="quest-quote-line" key={lineIndex}>
                  {renderQuestSegments(line)}
                </p>
              );
            }

            const separatorIndex = line.indexOf(":");
            const hasSpeaker =
              separatorIndex > 0 && separatorIndex < 60;
            return (
              <p className="quest-quote-line" key={lineIndex}>
                {hasSpeaker ? (
                  <>
                    <strong>{line.slice(0, separatorIndex + 1)}</strong>
                    {line.slice(separatorIndex + 1)}
                  </>
                ) : (
                  line
                )}
              </p>
            );
          })}
        </blockquote>
      );
    }

    return (
      <p
        className={`quest-paragraph${block.align ? ` quest-paragraph-${block.align}` : ""}`}
        key={key}
      >
        {renderQuestSegments(block.segments)}
      </p>
    );
  });
}

export default function QuestWorkspace() {
  const [query, setQuery] = useState("");
  const [selectedQuestId, setSelectedQuestId] = useState(
    questGuides[0]?.id ?? "",
  );
  const normalizedQuery = query.trim().toLocaleLowerCase("pl");
  const filteredQuests = normalizedQuery
    ? questGuides.filter((quest) =>
        `${quest.title} ${quest.author}`
          .toLocaleLowerCase("pl")
          .includes(normalizedQuery),
      )
    : questGuides;
  const selectedQuest =
    filteredQuests.find((quest) => quest.id === selectedQuestId) ??
    filteredQuests[0];

  return (
    <section aria-label="Poradniki questów" className="workspace quests-workspace">
      <aside className="catalog quests-catalog">
        <div className="catalog-heading">
          <div>
            <p className="eyebrow">ŚWIAT</p>
            <h2>Questy</h2>
          </div>
          <span className="result-count">{filteredQuests.length}</span>
        </div>
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Szukaj poradnika"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Szukaj poradnika..."
            type="search"
            value={query}
          />
        </label>
        <div className="entry-list">
          {filteredQuests.map((quest) => (
            <button
              aria-pressed={selectedQuest?.id === quest.id}
              className={`entry quest-entry${selectedQuest?.id === quest.id ? " selected" : ""}`}
              key={quest.id}
              onClick={() => setSelectedQuestId(quest.id)}
              type="button"
            >
              <span aria-hidden="true" className="entry-icon quest-icon">
                Q
              </span>
              <span className="quest-entry-copy">
                <strong>{quest.title}</strong>
                <small>{quest.author}</small>
              </span>
            </button>
          ))}
          {filteredQuests.length === 0 && (
            <p className="empty-state">Nie znaleziono poradnika.</p>
          )}
        </div>
      </aside>

      {selectedQuest ? (
        <article className="details quest-reader">
          <header className="quest-header">
            <p className="eyebrow">PORADNIK QUESTOWY</p>
            <h2>{selectedQuest.title}</h2>
            <p className="quest-author">
              Przygotował: <strong>{selectedQuest.author}</strong>
            </p>
          </header>
          <div className={`quest-content quest-content-${selectedQuest.id}`}>
            {renderQuestBlocks(selectedQuest.blocks, selectedQuest.id)}
          </div>
        </article>
      ) : (
        <div className="details quest-empty">
          <p>Wybierz poradnik z listy.</p>
        </div>
      )}
    </section>
  );
}
