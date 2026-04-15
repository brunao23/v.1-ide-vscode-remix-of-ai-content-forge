interface LoomEmbedProps {
  videoId: string;
  title?: string;
  hideOwner?: boolean;
  hideShare?: boolean;
  hideTitle?: boolean;
  hideTopBar?: boolean;
  autoplay?: boolean;
  className?: string;
}

function resolveLoomId(inputValue: string): string | null {
  const input = (inputValue || "").trim();
  if (!input) return null;

  if (/^[a-zA-Z0-9]{20,64}$/.test(input)) {
    return input;
  }

  try {
    const url = new URL(input);
    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.findIndex((segment) => segment === "share" || segment === "embed");
    if (marker >= 0 && parts[marker + 1]) {
      return parts[marker + 1];
    }
  } catch {
    return null;
  }

  return null;
}

export function LoomEmbed({
  videoId,
  title = "Vídeo",
  hideOwner = true,
  hideShare = true,
  hideTitle = true,
  hideTopBar = true,
  autoplay = false,
  className = "",
}: LoomEmbedProps) {
  const resolvedVideoId = resolveLoomId(videoId);
  if (!resolvedVideoId) {
    return (
      <div className="w-full rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Esta aula ainda não possui vídeo disponível para reprodução.
      </div>
    );
  }

  const params = new URLSearchParams();
  if (hideOwner) params.append("hide_owner", "true");
  if (hideShare) params.append("hide_share", "true");
  if (hideTitle) params.append("hide_title", "true");
  if (hideTopBar) params.append("hideEmbedTopBar", "true");
  if (autoplay) params.append("autoplay", "true");

  const embedUrl = `https://www.loom.com/embed/${resolvedVideoId}?${params.toString()}`;

  return (
    <div className={`relative w-full ${className}`} style={{ paddingTop: "56.25%" }}>
      <iframe
        src={embedUrl}
        title={title}
        frameBorder="0"
        allowFullScreen
        className="absolute inset-0 h-full w-full rounded-lg"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      />
    </div>
  );
}
