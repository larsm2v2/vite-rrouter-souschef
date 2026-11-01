import React, { useEffect, useMemo, useRef, useState } from "react";
import FocusTrap from "focus-trap-react";
import "./OCRModal.css";
import apiClient from "../pages/Client";
import ImageGallery from "./ImageGallery";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "./Toast";
import ParsedRecipeEditor, { ParsedRecipe } from "./ParsedRecipeEditor";
import ImportReview, { ImportSource } from "./ImportReview";
import { useUserStorage } from "../../hooks/useUserStorage";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface OCRResponse {
  parsed?: ParsedRecipe;
  imageUrls?: string[];
  text?: string;
}

interface SelectedFile {
  file: File;
  url: string;
}

type Tab = "upload" | "text" | "gallery" | "preview" | "url";

// Local blob URLs cannot be saved, so a draft keeps the server's copies of uploaded images.
type DraftSource =
  | { kind: "image"; serverImages: string[]; text?: string }
  | { kind: "text"; text: string }
  | { kind: "url"; url: string; images: string[] };

interface ImportDraft {
  tab: Tab;
  ocrText: string;
  recipeUrl: string;
  parsedResult: ParsedRecipe | null;
  previewMode: "json" | "pretty";
  uploadedImages: string[];
  source: DraftSource | null;
  savedAt: number;
}

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DRAFT_SAVE_DELAY_MS = 500;

function timeAgo(timestamp: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export default function OCRModal({ isOpen, onClose }: Props) {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("upload");
  const [ocrText, setOcrText] = useState("");
  const [recipeUrl, setRecipeUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedRecipe | null>(null);
  const [previewMode, setPreviewMode] = useState<"json" | "pretty">("pretty");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [source, setSource] = useState<ImportSource | null>(null);
  const [draft, setDraft, clearDraft] = useUserStorage<ImportDraft | null>(
    "import-draft",
    "current",
    null,
    { maxAgeMs: DRAFT_MAX_AGE_MS },
  );

  const hasContent =
    parsedResult !== null || ocrText.trim() !== "" || recipeUrl.trim() !== "";

  const draftSnapshot = useMemo<ImportDraft | null>(() => {
    if (!hasContent) return null;
    let draftSource: DraftSource | null = null;
    if (source?.kind === "image") {
      draftSource = {
        kind: "image",
        serverImages: uploadedImages,
        text: source.text,
      };
    } else if (source) {
      draftSource = source;
    }
    return {
      tab,
      ocrText,
      recipeUrl,
      parsedResult,
      previewMode,
      uploadedImages,
      source: draftSource,
      savedAt: Date.now(),
    };
    // savedAt is refreshed only when real content changes
  }, [
    hasContent,
    tab,
    ocrText,
    recipeUrl,
    parsedResult,
    previewMode,
    uploadedImages,
    source,
  ]);

  // Save as the user works so an interruption never loses the review.
  useEffect(() => {
    if (!isOpen || !draftSnapshot) return;
    const timer = window.setTimeout(
      () => setDraft(draftSnapshot),
      DRAFT_SAVE_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [isOpen, draftSnapshot, setDraft]);

  // Object URLs must be revoked; track the latest list for unmount cleanup.
  const handleCloseRef = useRef<() => void>(() => {});
  const selectedFilesRef = useRef<SelectedFile[]>([]);
  useEffect(() => {
    selectedFilesRef.current = selectedFiles;
  }, [selectedFiles]);
  useEffect(
    () => () => {
      selectedFilesRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    },
    [],
  );

  // Lock page scroll and close on Escape while the modal is open.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const replaceSelectedFiles = (files: File[]) => {
    selectedFiles.forEach((item) => URL.revokeObjectURL(item.url));
    setSelectedFiles(
      files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    );
  };

  const resetAll = () => {
    selectedFiles.forEach((item) => URL.revokeObjectURL(item.url));
    setSelectedFiles([]);
    setSource(null);
    setParsedResult(null);
    setUploadedImages([]);
    setOcrText("");
    setRecipeUrl("");
    setPreviewMode("pretty");
    setTab("upload");
  };

  const closeModal = (keepDraft: boolean) => {
    if (keepDraft && draftSnapshot) {
      setDraft(draftSnapshot);
      showToast("Draft saved. Reopen Create Recipe to resume.", "info", {
        action: { label: "Discard", onClick: clearDraft },
      });
    } else if (!keepDraft) {
      clearDraft();
    }
    resetAll();
    onClose();
  };
  // Escape, the close button and the backdrop keep the draft; finishing an import clears it.
  const handleClose = () => closeModal(true);
  handleCloseRef.current = handleClose;

  const resumeDraft = () => {
    if (!draft) return;
    setOcrText(draft.ocrText);
    setRecipeUrl(draft.recipeUrl);
    setParsedResult(draft.parsedResult);
    setPreviewMode(draft.previewMode);
    setUploadedImages(draft.uploadedImages ?? []);
    const saved = draft.source;
    if (saved?.kind === "image") {
      setSource({
        kind: "image",
        images: saved.serverImages.map((url, index) => ({
          name: `Image ${index + 1}`,
          url,
          authenticated: true,
        })),
        text: saved.text,
      });
    } else {
      setSource(saved);
    }
    setTab(
      draft.parsedResult ? "preview" : draft.tab === "url" ? "url" : "text",
    );
  };

  if (!isOpen) return null;

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const picked = Array.from(files);
    for (const f of picked) {
      if (f.size > MAX_FILE_BYTES) {
        showToast(`File ${f.name} exceeds 20 MB limit`, "error");
        e.target.value = "";
        return;
      }
      if (!f.type.startsWith("image/")) {
        showToast(`File ${f.name} is not an image`, "error");
        e.target.value = "";
        return;
      }
    }

    replaceSelectedFiles(picked);
  };

  const onUpload = async () => {
    const files = selectedFiles.map((item) => item.file);
    if (files.length === 0) {
      showToast("Please choose one or more images first", "error");
      return;
    }

    // Check if user is authenticated
    if (!accessToken) {
      showToast(
        "You must be logged in to use OCR upload. Please log in first.",
        "error",
      );
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

      // Use longer timeout for AI parsing (60 seconds)
      const resp = await apiClient.post(`/api/ocr`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      });
      const data = resp.data as OCRResponse;
      const parsed = data?.parsed;
      if (parsed) {
        // Track uploaded image URLs
        if (data.imageUrls && data.imageUrls.length > 0) {
          setUploadedImages(data.imageUrls);
        }
        // Show preview so user can confirm before importing
        setSource({
          kind: "image",
          images: selectedFiles.map(({ file, url }) => ({
            name: file.name,
            url,
          })),
          text: data.text || ocrText || undefined,
        });
        setParsedResult(parsed);
        setTab("preview");
        return;
      }

      // If no parsed returned, fall back to editable text import
      showToast(
        "Server returned no parsed recipe. You can edit the text and import manually.",
        "info",
      );
      setTab("text");
    } catch (err: unknown) {
      console.error("OCR request failed");
      const msg =
        (
          err as {
            response?: { data?: { message?: string } };
            message?: string;
          }
        )?.response?.data?.message ||
        (err as { message?: string })?.message ||
        "Unknown error";
      showToast(`Upload failed: ${msg}`, "error");
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
    closeModal(false);
  };

  const onParseText = async () => {
    // Attempt to send the edited OCR text to the server for structured parsing
    if (!ocrText || ocrText.trim().length === 0) {
      showToast("Please paste or enter some text to parse first.", "error");
      return;
    }

    // Check if user is authenticated
    if (!accessToken) {
      showToast(
        "You must be logged in to use OCR parsing. Please log in first.",
        "error",
      );
      return;
    }

    setLoading(true);
    try {
      // POST as JSON { text: string }
      // Use longer timeout for AI parsing (60 seconds)
      const resp = await apiClient.post(
        `/api/ocr/parse`,
        {
          text: ocrText,
        },
        {
          timeout: 60000,
        },
      );
      const parsed = (resp.data as OCRResponse)?.parsed;
      if (parsed) {
        // Show preview so user can confirm before importing
        setSource({ kind: "text", text: ocrText });
        setParsedResult(parsed);
        setTab("preview");
        return;
      }

      // If server returned no parsed recipe, fall back to import-as-instructions
      showToast(
        "Server was unable to parse structured recipe data. The text will be imported as raw instructions instead.",
        "info",
      );
      onImportText();
    } catch (err: unknown) {
      console.error("Text parsing failed");
      const msg =
        (
          err as {
            response?: { data?: { message?: string } };
            message?: string;
          }
        )?.response?.data?.message ||
        (err as { message?: string })?.message ||
        "Unknown error";
      showToast(
        `Parsing failed: ${msg}. Importing as raw instructions instead.`,
        "error",
      );
      onImportText();
    } finally {
      setLoading(false);
    }
  };

  const onImportUrl = async (event: React.FormEvent) => {
    event.preventDefault();
    let url: URL;
    try {
      url = new URL(recipeUrl.trim());
    } catch {
      showToast("Enter a valid recipe URL", "error");
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      showToast("Recipe URLs must use HTTP or HTTPS", "error");
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post<OCRResponse>(
        "/api/recipes/import-url",
        { url: url.toString() },
        { timeout: 15000 },
      );
      if (!response.data.parsed) {
        throw new Error("No structured recipe data found on that page");
      }
      setParsedResult(response.data.parsed);
      setUploadedImages(response.data.imageUrls ?? []);
      setSource({
        kind: "url",
        url: url.toString(),
        images: response.data.imageUrls ?? [],
      });
      setPreviewMode("pretty");
      setTab("preview");
    } catch (error: unknown) {
      const responseError = error as {
        response?: { data?: { error?: string; message?: string } };
        message?: string;
      };
      showToast(
        responseError.response?.data?.error ??
          responseError.response?.data?.message ??
          responseError.message ??
          "Could not import that recipe URL",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const acceptParsed = async () => {
    if (!parsedResult) return;

    setLoading(true);
    try {
      // Prepare recipe data with images
      const recipeToSave = {
        ...parsedResult,
        images: uploadedImages.map((url, idx) => ({
          imageUrl: url,
          isPrimary: idx === 0, // First image is primary
        })),
      };

      // Save the recipe to the database
      await apiClient.post("/api/recipes", recipeToSave);
      showToast("Recipe saved successfully!", "success");

      // Also dispatch event for any listeners (like RecipeGenerator)
      window.dispatchEvent(
        new CustomEvent("ocr:import", { detail: parsedResult }),
      );

      setParsedResult(null);
      closeModal(false);
    } catch (err: unknown) {
      console.error("Failed to save imported recipe");
      const msg =
        (
          err as {
            response?: { data?: { message?: string } };
            message?: string;
          }
        )?.response?.data?.message ||
        (err as { message?: string })?.message ||
        "Unknown error";
      showToast(`Failed to save recipe: ${msg}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const cancelPreview = () => {
    // keep parsedResult available but go back to text for edits
    if (!ocrText && source?.kind === "image" && source.text) {
      setOcrText(source.text);
    }
    setTab("text");
  };

  const rejectParsed = () => {
    // discard parsed result and return to text editor
    clearDraft();
    setParsedResult(null);
    setTab("text");
  };

  return (
    <div
      className="ocr-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ocr-modal-title"
    >
      <FocusTrap
        focusTrapOptions={{
          escapeDeactivates: false,
          clickOutsideDeactivates: false,
          allowOutsideClick: true,
          fallbackFocus: ".ocr-modal",
        }}
      >
        <div
          className={`ocr-modal ${tab === "preview" ? "ocr-modal--review" : ""}`}
          tabIndex={-1}
        >
          <header className="ocr-modal-header">
            <h3 className="ocr-modal-title" id="ocr-modal-title">
              OCR Import
            </h3>
            <button
              type="button"
              className="ocr-modal-close"
              onClick={handleClose}
              aria-label="Close"
            >
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
            <button
              onClick={() => setTab("url")}
              className={tab === "url" ? "active" : ""}
            >
              From URL
            </button>
          </nav>

          <div className="ocr-modal-body">
            {draft && !hasContent && (
              <div className="ocr-draft-banner" role="status">
                <span>
                  Resume draft:{" "}
                  <strong>
                    {draft.parsedResult?.name ||
                      draft.recipeUrl ||
                      "Untitled import"}
                  </strong>
                  , saved {timeAgo(draft.savedAt)}
                </span>
                <div className="ocr-draft-actions">
                  <button type="button" onClick={resumeDraft}>
                    Resume
                  </button>
                  <button type="button" onClick={clearDraft}>
                    Discard draft
                  </button>
                </div>
              </div>
            )}
            {tab === "upload" && (
              <div className="ocr-upload">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onFileChange}
                  aria-label="Choose one or more images"
                />
                {selectedFiles.length > 0 && (
                  <ul
                    className="ocr-selected-files"
                    aria-label="Selected images"
                  >
                    {selectedFiles.map(({ file, url }) => (
                      <li
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                      >
                        <img src={url} alt={`Preview of ${file.name}`} />
                        <span>{file.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="ocr-upload-actions">
                  <button
                    onClick={onUpload}
                    disabled={loading || selectedFiles.length === 0}
                  >
                    {loading
                      ? "Processing with AI..."
                      : "Upload & Parse with AI"}
                  </button>
                  <small>Max file size: 20 MB per image</small>
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

            {tab === "url" && (
              <form className="ocr-url-import" onSubmit={onImportUrl}>
                <label htmlFor="recipe-import-url">Recipe URL</label>
                <input
                  id="recipe-import-url"
                  type="url"
                  value={recipeUrl}
                  onChange={(event) => setRecipeUrl(event.target.value)}
                  placeholder="https://example.com/recipe"
                  required
                />
                <button type="submit" disabled={loading || !recipeUrl.trim()}>
                  {loading ? "Importing..." : "Import recipe"}
                </button>
              </form>
            )}

            {tab === "preview" && parsedResult && (
              <div className="ocr-preview">
                <div className="ocr-preview-header">
                  <h4>Confirm parsed recipe</h4>
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

                <ImportReview source={source}>
                  {previewMode === "json" ? (
                    <pre className="preview-json">
                      {JSON.stringify(parsedResult, null, 2)}
                    </pre>
                  ) : (
                    <ParsedRecipeEditor
                      recipe={parsedResult}
                      onChange={(recipe) => setParsedResult(recipe)}
                    />
                  )}
                </ImportReview>

                <div className="ocr-preview-actions">
                  <button onClick={acceptParsed} disabled={loading}>
                    Accept & Import
                  </button>
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
      </FocusTrap>
    </div>
  );
}
