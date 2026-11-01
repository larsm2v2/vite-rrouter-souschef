import { useEffect, useState } from "react";
import apiClient from "../pages/Client";

interface Props {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

/** <img> cannot send the Bearer token, so protected images are fetched as blobs. */
export default function AuthImage({ src, alt, className, style }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    apiClient
      .get<Blob>(src, { responseType: "blob" })
      .then((resp) => {
        if (cancelled) return;
        created = URL.createObjectURL(resp.data);
        setObjectUrl(created);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [src]);

  if (failed) return <em>Image no longer available</em>;
  if (!objectUrl) return <em>Loading…</em>;
  return <img src={objectUrl} alt={alt} className={className} style={style} />;
}
