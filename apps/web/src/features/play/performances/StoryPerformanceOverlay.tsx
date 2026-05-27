import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { StoryPerformanceDefinition } from "@story-game/shared";

interface StoryPerformanceOverlayProps {
  performanceId: string;
  performance: StoryPerformanceDefinition;
  resolveAssetUrl: (relativePath: string) => string;
  onDone: () => void;
}

export function StoryPerformanceOverlay({
  performanceId,
  performance,
  resolveAssetUrl,
  onDone,
}: StoryPerformanceOverlayProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const doneRef = useRef(onDone);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTimerRef = useRef<number | null>(null);

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const timer = window.setTimeout(() => doneRef.current(), performance.durationMs + 250);
    return () => window.clearTimeout(timer);
  }, [performance.durationMs, performanceId]);

  useEffect(() => {
    if (performance.renderer === "layeredCss") {
      const relPath = performance.audio.main;
      if (!relPath) return;
      audioTimerRef.current = window.setTimeout(() => {
        audioRef.current = playAudio(resolveAssetUrl(relPath));
      }, 1050);
    } else if (performance.renderer === "audio") {
      const relPath = performance.audio.main ?? performance.audio.fallback;
      if (relPath) audioRef.current = playAudio(resolveAssetUrl(relPath));
    } else if (performance.renderer === "image") {
      const relPath = performance.audio.main ?? performance.audio.fallback;
      if (relPath) audioRef.current = playAudio(resolveAssetUrl(relPath));
    }

    return () => {
      if (audioTimerRef.current) window.clearTimeout(audioTimerRef.current);
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [performance, resolveAssetUrl]);

  const layerUrls = useMemo(() => {
    return Object.fromEntries(
      Object.entries(performance.layers).map(([key, relPath]) => [key, resolveAssetUrl(relPath)])
    ) as Record<string, string>;
  }, [performance.layers, resolveAssetUrl]);

  function handleVideoError() {
    setVideoFailed(true);
    const fallback = performance.audio.fallback ?? performance.audio.main;
    if (fallback) audioRef.current = playAudio(resolveAssetUrl(fallback));
  }

  const overlay = (
    <div className={`story-performance story-performance-${performance.renderer}`} role="dialog" aria-label={performance.name}>
      <button className="story-performance-skip" onClick={onDone} aria-label="跳过演出" title="跳过演出">
        <X size={18} />
      </button>

      {performance.renderer === "video" && !videoFailed ? (
        <video
          className="story-performance-video"
          poster={performance.video?.poster ? resolveAssetUrl(performance.video.poster) : undefined}
          autoPlay
          playsInline
          onEnded={onDone}
          onError={handleVideoError}
          onCanPlay={(event) => {
            event.currentTarget.play().catch(handleVideoError);
          }}
        >
          {performance.video?.webm ? <source src={resolveAssetUrl(performance.video.webm)} type="video/webm" /> : null}
          {performance.video?.mp4 ? <source src={resolveAssetUrl(performance.video.mp4)} type="video/mp4" /> : null}
        </video>
      ) : null}

      {performance.renderer === "video" && videoFailed ? (
        <ImageFallback performance={performance} resolveAssetUrl={resolveAssetUrl} />
      ) : null}

      {performance.renderer === "layeredCss" ? (
        <LayeredKungfuPerformance layerUrls={layerUrls} name={performance.name} />
      ) : null}

      {performance.renderer === "audio" ? (
        <div className="story-performance-audio-pulse">
          <span>{performance.name}</span>
        </div>
      ) : null}

      {performance.renderer === "image" ? (
        <ImageFallback performance={performance} resolveAssetUrl={resolveAssetUrl} />
      ) : null}
    </div>
  );

  return createPortal(overlay, document.body);
}

function LayeredKungfuPerformance({ layerUrls, name }: { layerUrls: Record<string, string>; name: string }) {
  return (
    <div className="kungfu-performance" aria-label={name}>
      {layerUrls.bg ? <img className="kungfu-bg" src={layerUrls.bg} alt="" /> : null}
      <div className="kungfu-vignette" />
      {layerUrls.smoke ? <img className="kungfu-smoke kungfu-smoke-back" src={layerUrls.smoke} alt="" /> : null}
      {layerUrls.characterIdle ? <img className="kungfu-character kungfu-character-idle" src={layerUrls.characterIdle} alt="" /> : null}
      {layerUrls.characterAttack ? <img className="kungfu-character kungfu-character-attack" src={layerUrls.characterAttack} alt="" /> : null}
      {layerUrls.title ? <img className="kungfu-title" src={layerUrls.title} alt={name} /> : null}
      {layerUrls.lightStreak ? <img className="kungfu-streak" src={layerUrls.lightStreak} alt="" /> : null}
      {layerUrls.dragon ? <img className="kungfu-dragon" src={layerUrls.dragon} alt="" /> : null}
      {layerUrls.shockwave ? <img className="kungfu-shockwave" src={layerUrls.shockwave} alt="" /> : null}
      {layerUrls.burst ? <img className="kungfu-burst" src={layerUrls.burst} alt="" /> : null}
      {layerUrls.smoke ? <img className="kungfu-smoke kungfu-smoke-front" src={layerUrls.smoke} alt="" /> : null}
      {layerUrls.flash ? <img className="kungfu-flash" src={layerUrls.flash} alt="" /> : null}
    </div>
  );
}

function ImageFallback({
  performance,
  resolveAssetUrl,
}: {
  performance: StoryPerformanceDefinition;
  resolveAssetUrl: (relativePath: string) => string;
}) {
  const imagePath = performance.video?.poster ?? performance.layers.bg ?? Object.values(performance.layers)[0];
  if (!imagePath) {
    return (
      <div className="story-performance-audio-pulse">
        <span>{performance.name}</span>
      </div>
    );
  }
  return (
    <div className="story-performance-image-wrap">
      <img className="story-performance-image" src={resolveAssetUrl(imagePath)} alt={performance.name} />
    </div>
  );
}

function playAudio(url: string) {
  const audio = new Audio(url);
  audio.play().catch(() => {});
  return audio;
}
