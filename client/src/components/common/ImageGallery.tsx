import { useEffect, useState } from "react";
import apiClient from "../pages/Client";
import { useToast } from "./Toast";

type Item = {
  id: string;
  originalUrl?: string;
  processedUrl?: string;
  createdAt?: string;
  meta?: Record<string, unknown>;
};

export default function ImageGallery() {
  const { showToast } = useToast();
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

  const onDelete = async (id: string) => {
    if (!confirm("Delete this artifact?")) return;
    try {
      await apiClient.delete(`/api/ocr/${id}`);
      setItems((s) => s.filter((it) => it.id !== id));
    } catch {
      console.error("Failed to update image gallery");
      showToast("Failed to delete", "error");
    }
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
                    <img src={it.originalUrl} style={{ maxWidth: 200 }} />
                  ) : (
                    <em>n/a</em>
                  )}
                </td>
                <td style={{ padding: 8 }}>
                  {it.processedUrl ? (
                    <img src={it.processedUrl} style={{ maxWidth: 200 }} />
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
