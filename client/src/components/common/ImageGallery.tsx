import { useEffect, useState } from "react";
import axios from "axios";

type Item = {
  id: string;
  originalUrl?: string;
  processedUrl?: string;
  createdAt?: string;
  meta?: Record<string, unknown>;
};

export default function ImageGallery() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
      const resp = await axios.get(`${apiUrl}/api/ocr/gallery`);
      setItems((resp.data as Item[]) || []);
    } catch (err) {
      console.error(err);
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
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
      await axios.delete(`${apiUrl}/api/ocr/${id}`);
      setItems((s) => s.filter((it) => it.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete");
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
