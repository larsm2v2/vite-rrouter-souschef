import React, { useState, useRef } from "react";
import "./OCRModal.css";
import { extractTextWithTesseract } from "../../utils/ocr";
import axios from "axios";
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
  const [tab, setTab] = useState<"upload" | "text" | "gallery">("upload");
  const [ocrText, setOcrText] = useState("");
  const [loading, setLoading] = useState(false);
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
    setLoading(true);
    try {
      const form = new FormData();
      // Append all selected files. Server should accept multiple images.
      for (let i = 0; i < files.length; i++) {
        form.append("image", files[i]);
      }
      form.append("ocrText", ocrText || "");

      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
      const resp = await axios.post(`${apiUrl}/api/ocr/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const parsed = (resp.data as OCRResponse)?.parsed;
      if (parsed) {
        // dispatch to listeners (RecipeGenerator listens to this event)
        window.dispatchEvent(new CustomEvent("ocr:import", { detail: parsed }));
        onClose();
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
              />
              <div className="ocr-text-actions">
                <button onClick={onImportText}>
                  Import Text as Instructions
                </button>
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
