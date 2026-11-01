import {
  ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import "./ImportReview.css";
import AuthImage from "./AuthImage";

export type ImportSource =
  | {
      kind: "image";
      images: { name: string; url: string; authenticated?: boolean }[];
      text?: string;
    }
  | { kind: "text"; text: string }
  | { kind: "url"; url: string; images: string[] };

interface Props {
  source: ImportSource | null;
  /** The editable parsed recipe (rendered in the "Parsed" pane). */
  children: ReactNode;
}

type Pane = "original" | "parsed";

const WIDE_QUERY = "(min-width: 1100px)";

function subscribeToWide(callback: () => void) {
  const media = window.matchMedia(WIDE_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function useIsWide() {
  return useSyncExternalStore(
    subscribeToWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

function OriginalPane({ source }: { source: ImportSource | null }) {
  const [zoomed, setZoomed] = useState<string | null>(null);

  if (!source) {
    return (
      <p className="review-empty">
        No original source is available for this recipe.
      </p>
    );
  }

  const frames = (
    items: {
      key: string;
      label: string;
      url: string;
      authenticated?: boolean;
    }[],
  ) =>
    items.map((item, index) => (
      <figure className="review-figure" key={item.key}>
        <figcaption>
          {items.length > 1
            ? `Image ${index + 1} of ${items.length}`
            : "Original image"}
        </figcaption>
        <div
          className={`review-image-frame ${
            zoomed === item.key ? "zoomed" : ""
          }`}
        >
          <button
            type="button"
            className="review-image-btn"
            aria-pressed={zoomed === item.key}
            aria-label={`${zoomed === item.key ? "Fit" : "Zoom"} ${item.label}`}
            onClick={() =>
              setZoomed((current) => (current === item.key ? null : item.key))
            }
          >
            {item.authenticated ? (
              <AuthImage src={item.url} alt={item.label} />
            ) : (
              <img
                src={item.url}
                alt={item.label}
                referrerPolicy="no-referrer"
              />
            )}
          </button>
        </div>
      </figure>
    ));

  if (source.kind === "image") {
    return (
      <>
        {frames(
          source.images.map((image, index) => ({
            key: `${index}-${image.name}`,
            label: image.name,
            url: image.url,
            authenticated: image.authenticated,
          })),
        )}
        {source.text && (
          <details className="review-details" open={source.images.length === 0}>
            <summary>Recognized text</summary>
            <pre className="review-text">{source.text}</pre>
          </details>
        )}
      </>
    );
  }

  if (source.kind === "text") {
    return (
      <>
        <p className="review-caption">Text you pasted</p>
        <pre className="review-text">{source.text}</pre>
      </>
    );
  }

  let host = source.url;
  try {
    host = new URL(source.url).hostname;
  } catch {
    // keep the raw value
  }
  return (
    <>
      <p className="review-caption">
        Imported from{" "}
        <a href={source.url} target="_blank" rel="noopener noreferrer">
          {host}
        </a>
      </p>
      {frames(
        source.images.map((url, index) => ({
          key: `${index}-${url}`,
          label: `Recipe image ${index + 1}`,
          url,
        })),
      )}
      {source.images.length === 0 && (
        <p className="review-empty">
          Open the page to compare against the original recipe.
        </p>
      )}
    </>
  );
}

export default function ImportReview({ source, children }: Props) {
  const baseId = useId();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<Pane>("parsed");
  const wide = useIsWide();

  // Start on the parsed pane; the original sits one swipe to the left.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (track && track.scrollWidth > track.clientWidth) {
      track.scrollLeft = track.clientWidth;
    }
  }, []);

  const show = (pane: Pane) => {
    setActive(pane);
    const track = trackRef.current;
    if (!track) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    track.scrollTo({
      left: pane === "original" ? 0 : track.clientWidth,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track || wide || track.clientWidth === 0) return;
    setActive(track.scrollLeft > track.clientWidth / 2 ? "parsed" : "original");
  };

  const onTabKeyDown = (event: React.KeyboardEvent, pane: Pane) => {
    if (event.key === "ArrowRight" && pane === "original") {
      event.preventDefault();
      show("parsed");
      document.getElementById(`${baseId}-tab-parsed`)?.focus();
    } else if (event.key === "ArrowLeft" && pane === "parsed") {
      event.preventDefault();
      show("original");
      document.getElementById(`${baseId}-tab-original`)?.focus();
    }
  };

  const tab = (pane: Pane, label: string) => (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${pane}`}
      aria-selected={active === pane}
      aria-controls={`${baseId}-pane-${pane}`}
      tabIndex={active === pane ? 0 : -1}
      className={`review-tab ${active === pane ? "active" : ""}`}
      onClick={() => show(pane)}
      onKeyDown={(event) => onTabKeyDown(event, pane)}
    >
      {label}
    </button>
  );

  return (
    <div className="import-review">
      <div
        className="review-tabs"
        role="tablist"
        aria-label="Compare original and parsed"
      >
        {tab("original", "Original")}
        {tab("parsed", "Parsed")}
      </div>
      <p className="review-hint" aria-hidden="true">
        Swipe sideways to compare the original with the parsed recipe.
      </p>
      <div className="review-track" ref={trackRef} onScroll={onScroll}>
        <section
          className="review-pane review-pane-original"
          role="tabpanel"
          id={`${baseId}-pane-original`}
          aria-labelledby={`${baseId}-tab-original`}
          tabIndex={0}
          inert={!wide && active !== "original"}
        >
          <h4 className="review-pane-title">Original</h4>
          <OriginalPane source={source} />
        </section>
        <section
          className="review-pane review-pane-parsed"
          role="tabpanel"
          id={`${baseId}-pane-parsed`}
          aria-labelledby={`${baseId}-tab-parsed`}
          inert={!wide && active !== "parsed"}
        >
          <h4 className="review-pane-title">Parsed</h4>
          {children}
        </section>
      </div>
    </div>
  );
}
