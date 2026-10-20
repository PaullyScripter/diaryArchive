"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/media-url";

export function useAuthenticatedMediaUrl(src: string) {
  const [resolved, setResolved] = useState(src);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    const stablePath = src.replace(/^https?:\/\/[^/]+/, "");

    if (!stablePath.startsWith("/api/v1/media/file/")) {
      setResolved(resolveMediaUrl(src) || src);
      return () => {
        active = false;
      };
    }

    const load = async () => {
      try {
        const response = await apiClient.get(
          stablePath.replace(/^\/api\/v1/, "") || "/",
          { responseType: "blob" },
        );
        objectUrl = URL.createObjectURL(response.data as Blob);
        if (active) {
          setResolved(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
        }
      } catch {
        if (active) setResolved(resolveMediaUrl(src) || src);
      }
    };
    load();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return resolved;
}

export function AuthenticatedMediaImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const resolved = useAuthenticatedMediaUrl(src);
  return (
    // Dynamic authenticated/blob media cannot use Next's optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={resolved} alt={alt} className={className} />
  );
}

export function AuthenticatedMediaLink({
  src,
  children,
  className,
}: {
  src: string;
  children: React.ReactNode;
  className?: string;
}) {
  const resolved = useAuthenticatedMediaUrl(src);
  return (
    <a href={resolved} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  );
}
