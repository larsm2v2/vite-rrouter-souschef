import { useEffect, useState } from "react";
import apiClient from "../pages/Client";
import { useToast } from "./Toast";
import AuthImage from "./AuthImage";
import { useUndoable } from "../../hooks/useUndoable";

type Item = {
  id: string;
  originalUrl?: string;
  processedUrl?: string;
  createdAt?: string;
  meta?: Record<string, unknown>;
};

export default function ImageGallery() {
  const { showToast } = useToast();
  const undoable = useUndoable();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const resp = await apiClient.get("/api/ocr/gallery");
      setItems((resp.data as Item[]) || []);
    } catch {
      console.error("Failed to load image gallery");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const onDelete = (id: string) => {
    const index = items.findIndex((it) => it.id === id);
    const removed = items[index];
    if (!removed) return;
    // The server delete is irreversible, so it waits until the undo window closes.
    undoable({
      message: "Image deleted",
      apply: () => setItems((s) => s.filter((it) => it.id !== id)),
      revert: () =>
        setItems((s) => {
          if (s.some((it) => it.id === id)) return s;
          const next = [...s];
          next.splice(Math.min(index, next.length), 0, removed);
          return next;
        }),
      commit: async () => {
        try {
          await apiClient.delete(`/api/ocr/${encodeURIComponent(id)}`);
        } catch {
          console.error("Failed to update image gallery");
          showToast("Failed to delete", "error");
          fetchList();
        }
      },
    });
  };

  return (
    <div className="image-gallery">
      {loading && <div>Loading...</div>}
      {!loading && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead className="ocr-columns">
            <tr>
              <th className="ocr-column">Original</th>
              <th className="ocr-column">Processed</th>
              <th className="ocr-column">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td style={{ padding: 8 }}>
                  {it.originalUrl ? (
                    <AuthImage src={it.originalUrl} alt={`Original ${it.id}`} />
                  ) : (
                    <em>n/a</em>
                  )}
                </td>
                <td style={{ padding: 8 }}>
                  {it.processedUrl ? (
                    <AuthImage
                      src={it.processedUrl}
                      alt={`Processed ${it.id}`}
                    />
                  ) : (
                    <em>n/a</em>
                  )}
                </td>
                <td style={{ padding: 8 }}>
                  <button onClick={() => onDelete(it.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={3}>No artifacts found</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
