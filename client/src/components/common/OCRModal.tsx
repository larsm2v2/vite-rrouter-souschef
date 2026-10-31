import React, { useState, useRef } from "react";
import "./OCRModal.css";
import apiClient from "../pages/Client";
import ImageGallery from "./ImageGallery";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "./Toast";
import ParsedRecipeEditor, { ParsedRecipe } from "./ParsedRecipeEditor";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface OCRResponse {
  parsed?: ParsedRecipe;
  imageUrls?: string[];
}

export default function OCRModal({ isOpen, onClose }: Props) {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<
    "upload" | "text" | "gallery" | "preview" | "url"
  >("upload");
  const [ocrText, setOcrText] = useState("");
  const [recipeUrl, setRecipeUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedRecipe | null>(null);
  const [previewMode, setPreviewMode] = useState<"json" | "pretty">("pretty");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Validate per-file size (20 MB) and collect files
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.size > 20 * 1024 * 1024) {
        showToast(`File ${f.name} exceeds 20 MB limit`, "error");
        return;
      }
    }

    // Skip client-side OCR - just show upload button
    // Server-side OCR with Gemini AI is more reliable
    console.log(`${files.length} file(s) selected, ready for server upload`);
  };

  const onUpload = async () => {
    const input = fileRef.current;
    const files = input?.files;
    if (!files || files.length === 0) {
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
    onClose();
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
      onClose();
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
          <button
            onClick={() => setTab("url")}
            className={tab === "url" ? "active" : ""}
          >
            From URL
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
                  {loading ? "Processing with AI..." : "Upload & Parse with AI"}
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
                  <ParsedRecipeEditor
                    recipe={parsedResult}
                    onChange={(recipe) => setParsedResult(recipe)}
                  />
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
