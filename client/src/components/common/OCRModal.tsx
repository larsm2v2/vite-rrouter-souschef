import React, { useState, useRef } from "react";
import "./OCRModal.css";
import { extractTextWithTesseract } from "../../utils/ocr";
import apiClient from "../pages/Client";
import ImageGallery from "./ImageGallery";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedRecipe {
  name?: string;
  cuisine?: string;
  ingredients: { [key: string]: string[] };
  instructions: { number: number; text: string }[];
  notes: string[];
}

interface OCRResponse {
  parsed?: ParsedRecipe;
}

export default function OCRModal({ isOpen, onClose }: Props) {
  const [tab, setTab] = useState<"upload" | "text" | "gallery" | "preview">(
    "upload"
  );
  const [ocrText, setOcrText] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedRecipe | null>(null);
  const [previewMode, setPreviewMode] = useState<"json" | "pretty">("pretty");
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Validate per-file size (5 MB) and collect files
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.size > 20 * 1024 * 1024) {
        alert(`File ${f.name} exceeds 20 MB limit`);
        return;
      }
    }

    // Run OCR locally on all selected files sequentially and concatenate results
    setLoading(true);
    try {
      const texts: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        try {
          const text = await extractTextWithTesseract(f);
          texts.push(`=== ${f.name} ===\n${text.trim()}`);
        } catch (err) {
          console.error(`OCR failed for ${f.name}:`, err);
          texts.push(`=== ${f.name} ===\n[OCR failed for this file]\n`);
        }
      }
      setOcrText(texts.join("\n\n"));
      setTab("text");
    } catch (err) {
      console.error(err);
      alert(
        "OCR failed locally. You can still upload the image(s) for server parsing."
      );
      setTab("upload");
    } finally {
      setLoading(false);
    }
  };

  const onUpload = async () => {
    const input = fileRef.current;
    const files = input?.files;
    if (!files || files.length === 0) {
      alert("Please choose one or more images first");
      return;
    }

    // Check if user is authenticated
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      alert("You must be logged in to use OCR upload. Please log in first.");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      // Append all selected files. Server should accept multiple images.
      for (let i = 0; i < files.length; i++) {
        form.append("image", files[i]);
      }
      form.append("ocrText", ocrText || "");

      const resp = await apiClient.post(`/api/ocr`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const parsed = (resp.data as OCRResponse)?.parsed;
      if (parsed) {
        // Show preview so user can confirm before importing
        setParsedResult(parsed);
        setTab("preview");
        return;
      }

      // If no parsed returned, fall back to editable text import
      alert(
        "Server returned no parsed recipe. You can edit the text and import manually."
      );
      setTab("text");
    } catch (err: unknown) {
      console.error(err);
      const msg =
        (
          err as {
            response?: { data?: { message?: string } };
            message?: string;
          }
        )?.response?.data?.message ||
        (err as { message?: string })?.message ||
        "Unknown error";
      alert(`Upload failed: ${msg}`);
      setTab("text");
    } finally {
      setLoading(false);
    }
  };

  const onImportText = () => {
    // Build a minimal GeneratedRecipe-style object with OCR text in notes
    const parsed: ParsedRecipe = {
      name: undefined,
      cuisine: undefined,
      ingredients: { "from-ocr": [] },
      instructions: [{ number: 1, text: ocrText }],
      notes: ["Imported from OCR"],
    };

    window.dispatchEvent(new CustomEvent("ocr:import", { detail: parsed }));
    onClose();
  };

  const onParseText = async () => {
    // Attempt to send the edited OCR text to the server for structured parsing
    if (!ocrText || ocrText.trim().length === 0) {
      alert("Please paste or enter some text to parse first.");
      return;
    }

    // Check if user is authenticated
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      alert("You must be logged in to use OCR parsing. Please log in first.");
      return;
    }

    setLoading(true);
    try {
      // POST as JSON { text: string }
      const resp = await apiClient.post(`/api/ocr/parse`, {
        text: ocrText,
      });
      const parsed = (resp.data as OCRResponse)?.parsed;
      if (parsed) {
        // Show preview so user can confirm before importing
        setParsedResult(parsed);
        setTab("preview");
        return;
      }

      // If server returned no parsed recipe, fall back to import-as-instructions
      alert(
        "Server was unable to parse structured recipe data. The text will be imported as raw instructions instead."
      );
      onImportText();
    } catch (err: unknown) {
      console.error("Text parse failed:", err);
      const msg =
        (
          err as {
            response?: { data?: { message?: string } };
            message?: string;
          }
        )?.response?.data?.message ||
        (err as { message?: string })?.message ||
        "Unknown error";
      alert(`Parsing failed: ${msg}. Importing as raw instructions instead.`);
      onImportText();
    } finally {
      setLoading(false);
    }
  };

  const acceptParsed = () => {
    if (!parsedResult) return;
    window.dispatchEvent(
      new CustomEvent("ocr:import", { detail: parsedResult })
    );
    setParsedResult(null);
    onClose();
  };

  const cancelPreview = () => {
    // keep parsedResult available but go back to text for edits
    setTab("text");
  };

  const rejectParsed = () => {
    // discard parsed result and return to text editor
    setParsedResult(null);
    setTab("text");
  };

  return (
    <div className="ocr-modal-overlay" role="dialog" aria-modal="true">
      <div className="ocr-modal">
        <header className="ocr-modal-header">
          <h3 className="ocr-modal-title">OCR Import</h3>
          <button onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <nav className="ocr-modal-tabs">
          <button
            onClick={() => setTab("upload")}
            className={tab === "upload" ? "active" : ""}
          >
            Upload
          </button>
          <button
            onClick={() => setTab("text")}
            className={tab === "text" ? "active" : ""}
          >
            Text Editor
          </button>
          <button
            onClick={() => setTab("gallery")}
            className={tab === "gallery" ? "active" : ""}
          >
            Gallery
          </button>
        </nav>

        <div className="ocr-modal-body">
          {tab === "upload" && (
            <div className="ocr-upload">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={onFileChange}
                aria-label="Choose one or more images"
              />
              <div className="ocr-upload-actions">
                <button onClick={onUpload} disabled={loading}>
                  {loading ? "Uploading..." : "Upload to Server"}
                </button>
                <small>Max file size: 20 MB</small>
              </div>
            </div>
          )}

          {tab === "text" && (
            <div className="ocr-text-editor">
              <textarea
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                rows={10}
                aria-label="OCR text editor"
              />
              <div className="ocr-text-actions">
                <button onClick={onParseText} disabled={loading}>
                  {loading ? "Parsing..." : "Parse Text on Server"}
                </button>
                <button onClick={onImportText} disabled={loading || !ocrText}>
                  Import Text as Instructions (raw)
                </button>
              </div>
            </div>
          )}

          {tab === "preview" && parsedResult && (
            <div className="ocr-preview">
              <div className="ocr-preview-header">
                <h4>Parsed Recipe Preview</h4>
                <div className="preview-toggle">
                  <label>
                    <input
                      type="radio"
                      name="previewMode"
                      checked={previewMode === "pretty"}
                      onChange={() => setPreviewMode("pretty")}
                    />{" "}
                    Pretty
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="previewMode"
                      checked={previewMode === "json"}
                      onChange={() => setPreviewMode("json")}
                    />{" "}
                    JSON
                  </label>
                </div>
              </div>

              <div className="ocr-preview-body">
                {previewMode === "json" ? (
                  <pre className="preview-json">
                    {JSON.stringify(parsedResult, null, 2)}
                  </pre>
                ) : (
                  <div className="preview-pretty">
                    <div className="preview-field">
                      <label className="preview-label">Name</label>
                      <input
                        className="preview-input"
                        value={parsedResult.name ?? ""}
                        onChange={(e) =>
                          setParsedResult((p) =>
                            p ? { ...p, name: e.target.value } : p
                          )
                        }
                        placeholder="Recipe name"
                      />
                    </div>

                    <div className="preview-field">
                      <label className="preview-label">Cuisine</label>
                      <input
                        className="preview-input"
                        value={parsedResult.cuisine ?? ""}
                        onChange={(e) =>
                          setParsedResult((p) =>
                            p ? { ...p, cuisine: e.target.value } : p
                          )
                        }
                        placeholder="Cuisine"
                      />
                    </div>

                    <div className="preview-section">
                      <strong>Ingredients</strong>
                      {Object.keys(parsedResult.ingredients).length === 0 && (
                        <div className="preview-empty">
                          No ingredients parsed.
                        </div>
                      )}
                      {Object.entries(parsedResult.ingredients).map(
                        ([group, items]) => (
                          <div key={group} className="ingredient-group">
                            {group !== "default" && (
                              <div className="ingredient-group-name">
                                {group}
                              </div>
                            )}
                            <ul className="ingredient-list">
                              {items.map((it, idx) => (
                                <li key={idx} className="ingredient-item">
                                  <input
                                    className="preview-input"
                                    value={it}
                                    onChange={(e) =>
                                      setParsedResult((p) => {
                                        if (!p) return p;
                                        const next = { ...p } as ParsedRecipe;
                                        next.ingredients = { ...p.ingredients };
                                        next.ingredients[group] = [...items];
                                        next.ingredients[group][idx] =
                                          e.target.value;
                                        return next;
                                      })
                                    }
                                  />
                                  <button
                                    className="tiny-btn"
                                    onClick={() =>
                                      setParsedResult((p) => {
                                        if (!p) return p;
                                        const next = { ...p } as ParsedRecipe;
                                        next.ingredients = { ...p.ingredients };
                                        next.ingredients[group] = [
                                          ...items.filter((_, i) => i !== idx),
                                        ];
                                        return next;
                                      })
                                    }
                                    aria-label="Remove ingredient"
                                  >
                                    ✕
                                  </button>
                                </li>
                              ))}
                            </ul>
                            <div className="ingredient-add">
                              <button
                                onClick={() =>
                                  setParsedResult((p) => {
                                    if (!p) return p;
                                    const next = { ...p } as ParsedRecipe;
                                    next.ingredients = { ...p.ingredients };
                                    next.ingredients[group] = [...items, ""];
                                    return next;
                                  })
                                }
                                className="add-btn"
                              >
                                + Add ingredient
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    <div className="preview-section">
                      <strong>Instructions</strong>
                      {(!parsedResult.instructions ||
                        parsedResult.instructions.length === 0) && (
                        <div className="preview-empty">
                          No instructions parsed.
                        </div>
                      )}
                      <ol className="instruction-list">
                        {parsedResult.instructions.map((ins, idx) => (
                          <li key={idx} className="instruction-item">
                            <textarea
                              className="instruction-textarea"
                              value={ins.text}
                              onChange={(e) =>
                                setParsedResult((p) => {
                                  if (!p) return p;
                                  const next = { ...p } as ParsedRecipe;
                                  next.instructions = p.instructions.map(
                                    (ii, j) =>
                                      j === idx
                                        ? { ...ii, text: e.target.value }
                                        : ii
                                  );
                                  return next;
                                })
                              }
                            />
                            <div className="instruction-actions">
                              <button
                                className="tiny-btn"
                                onClick={() =>
                                  setParsedResult((p) => {
                                    if (!p) return p;
                                    const next = { ...p } as ParsedRecipe;
                                    next.instructions = p.instructions
                                      .filter((_, i) => i !== idx)
                                      .map((ii, i) => ({
                                        ...ii,
                                        number: i + 1,
                                      }));
                                    return next;
                                  })
                                }
                                aria-label="Remove instruction"
                              >
                                ✕
                              </button>
                            </div>
                          </li>
                        ))}
                      </ol>
                      <div className="instruction-add">
                        <button
                          className="add-btn"
                          onClick={() =>
                            setParsedResult((p) => {
                              if (!p) return p;
                              const next = { ...p } as ParsedRecipe;
                              next.instructions = [
                                ...(p.instructions || []),
                                {
                                  number: (p.instructions?.length ?? 0) + 1,
                                  text: "",
                                },
                              ];
                              return next;
                            })
                          }
                        >
                          + Add instruction
                        </button>
                      </div>
                    </div>

                    {parsedResult.notes && parsedResult.notes.length > 0 && (
                      <div className="preview-section">
                        <strong>Notes</strong>
                        <ul>
                          {parsedResult.notes.map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="ocr-preview-actions">
                <button onClick={acceptParsed}>Accept & Import</button>
                <button onClick={cancelPreview}>Edit Text</button>
                <button onClick={rejectParsed}>Discard</button>
              </div>
            </div>
          )}

          {tab === "gallery" && (
            <div className="ocr-gallery-tab">
              <ImageGallery />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
