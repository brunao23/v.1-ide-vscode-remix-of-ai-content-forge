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
  const params = new URLSearchParams();
  if (hideOwner) params.append("hide_owner", "true");
  if (hideShare) params.append("hide_share", "true");
  if (hideTitle) params.append("hide_title", "true");
  if (hideTopBar) params.append("hideEmbedTopBar", "true");
  if (autoplay) params.append("autoplay", "true");

  const embedUrl = `https://www.loom.com/embed/${videoId}?${params.toString()}`;

  return (
    <div className={`relative w-full ${className}`} style={{ paddingTop: "56.25%" }}>
      <iframe
        src={embedUrl}
        title={title}
        frameBorder="0"
        allowFullScreen
        className="absolute inset-0 w-full h-full rounded-lg"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      />
    </div>
  );
}
