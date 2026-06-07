import { SearchResult } from "@/types/video";
import { startDrag } from '@crabnebula/tauri-plugin-drag';
import { resolveResource } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getFrameThumbnail, exportClip } from "@/services/api";
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { save } from '@tauri-apps/plugin-dialog';
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { Play, MoreVertical, Copy, Scissors, FolderOpen, X } from "lucide-react";

const iconPath = await resolveResource('icons/32x32.png');

// Seconds of footage to keep before/after the matched frame when exporting.
const CLIP_BEFORE = 120;
const CLIP_AFTER = 120;

export function SearchResultItem({ result, rank }: { result: SearchResult; rank?: number }) {
  const name = result.video.path.split('/').slice(-1)[0];
  const score = Math.round((result.confidence ?? 0) * 100);

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const dragClip = async (e: React.DragEvent) => {
    e.preventDefault();
    startDrag({
      item: [result.video.path],
      icon: iconPath,
    });
  }

  const revealClip = () => {
    revealItemInDir(result.video.path).catch((err) => {
      toast.error(`Failed to reveal clip: ${err.message ?? err}`);
    });
  };

  useEffect(() => {
    const fetchThumbnail = async () => {
      try {
        const arrayBuffer = await getFrameThumbnail(result.video.path, result.timestamp);
        const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        setThumbnailUrl(url);
      } catch (error) {
        console.error("Error fetching thumbnail:", error);
      }
    }
    fetchThumbnail();
    return () => {
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [result.video.path, result.timestamp]);

  return (
    <>
      <div
        draggable
        onDragStart={dragClip}
        onDoubleClick={revealClip}
        title="Drag to export · double-click to reveal in Finder"
        className="group corner-marks relative flex cursor-grab flex-col gap-2 active:cursor-grabbing"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-white/[0.02] ring-1 ring-white/8 transition-all duration-200 group-hover:ring-amber-400/60">
          {thumbnailUrl ? <img
            src={thumbnailUrl}
            alt={result.video.name}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          /> : <div className="flex h-full items-center justify-center bg-white/[0.04] text-[10px] text-white/50">Loading...</div>}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          <div className="absolute top-2 left-2 flex items-center gap-1 font-mono text-[10px] tracking-wider text-white/80">
            {typeof rank === "number" && (
              <span className="rounded-sm bg-black/70 px-1 py-0.5 backdrop-blur-sm">#{rank.toString().padStart(2, "0")}</span>
            )}
          </div>

          <div className="absolute top-2 right-2">
            <ScorePill score={score} />
          </div>

          {/* Hover: play the matched moment in-app */}
          <button
            onClick={(e) => { e.stopPropagation(); setPreviewOpen(true); }}
            onMouseDown={(e) => e.stopPropagation()}
            title="Preview"
            className="absolute inset-0 m-auto grid size-11 place-items-center rounded-full border border-white/25 bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100 hover:bg-black/80"
          >
            <Play className="size-4 translate-x-px fill-current" />
          </button>

          <div className="absolute right-2 bottom-2 left-2 flex items-end justify-between gap-2">
            <span className="rounded-sm bg-black/80 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-amber-300 backdrop-blur-sm">
              TC {formatTimecode(result.timestamp)}
            </span>
            <ResultMenu result={result} name={name} onReveal={revealClip} />
          </div>
        </div>

        <div className="px-0.5">
          <div className="truncate font-mono text-[11px] tracking-tight text-foreground" title={name}>
            {name}
          </div>
        </div>
      </div>

      {previewOpen && (
        <VideoPreview
          path={result.video.path}
          timestamp={result.timestamp}
          name={name}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  )
}

function ResultMenu({
  result,
  name,
  onReveal,
}: {
  result: SearchResult;
  name: string;
  onReveal: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const copyLocation = async () => {
    setOpen(false);
    try {
      await navigator.clipboard.writeText(result.video.path);
      toast.success("Location copied to clipboard");
    } catch {
      toast.error("Failed to copy location");
    }
  };

  const doExport = async () => {
    setOpen(false);
    const base = name.replace(/\.[^/.]+$/, "");
    // Keep the source container so ffmpeg's stream-copy can't hit a codec/container mismatch.
    const ext = name.includes(".") ? name.split(".").pop()! : "mp4";
    const out = await save({
      defaultPath: `${base}_clip_${Math.floor(result.timestamp)}s.${ext}`,
      filters: [{ name: "Video", extensions: [ext] }],
    });
    if (!out) return;
    toast.promise(
      exportClip(result.video.path, result.timestamp, CLIP_BEFORE, CLIP_AFTER, out),
      {
        loading: "Exporting ±2 min clip…",
        success: "Clip exported",
        error: (e) => `Export failed: ${e?.message ?? e}`,
      },
    );
  };

  return (
    <div ref={ref} className="relative" onDoubleClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        onMouseDown={(e) => e.stopPropagation()}
        title="More actions"
        className="grid size-6 place-items-center rounded-sm bg-black/75 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/90 hover:text-white"
      >
        <MoreVertical className="size-3.5" />
      </button>
      {open && (
        <div
          className="absolute right-0 bottom-7 z-20 w-44 overflow-hidden rounded-sm border border-white/10 bg-[oklch(0.08_0_0)] shadow-xl shadow-black/50"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <MenuItem icon={<Copy className="size-3.5" />} label="Copy location" onClick={copyLocation} />
          <MenuItem icon={<Scissors className="size-3.5" />} label="Export ±2 min clip" onClick={doExport} />
          <MenuItem icon={<FolderOpen className="size-3.5" />} label="Reveal in Finder" onClick={() => { setOpen(false); onReveal(); }} />
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 px-2.5 py-2 text-left font-mono text-[11px] tracking-tight text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white"
    >
      {icon}
      {label}
    </button>
  );
}

function VideoPreview({
  path,
  timestamp,
  name,
  onClose,
}: {
  path: string;
  timestamp: number;
  name: string;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = convertFileSrc(path);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const seekToMatch = () => {
    const el = videoRef.current;
    if (!el) return;
    try { el.currentTime = timestamp; } catch { /* ignore */ }
    el.play().catch(() => { /* autoplay may be blocked; controls remain */ });
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="truncate font-mono text-[11px] tracking-wider text-white/70">
            {name} · TC {formatTimecode(timestamp)}
          </span>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="grid size-7 shrink-0 place-items-center rounded-sm border border-white/10 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
        <video
          ref={videoRef}
          src={src}
          controls
          autoPlay
          onLoadedMetadata={seekToMatch}
          className="max-h-[70vh] w-full rounded-sm bg-black ring-1 ring-white/10"
        />
      </div>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const tone = score >= 70 ? "amber" : score >= 50 ? "neutral" : "dim";
  const colors = {
    amber: "border-amber-400/70 bg-amber-400/15 text-amber-200",
    neutral: "border-white/15 bg-white/[0.06] text-white/80",
    dim: "border-white/10 bg-white/[0.04] text-white/50",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] tracking-wider backdrop-blur-sm ${colors}`}>
      <span className="tabular-nums">{score.toString().padStart(2, "0")}</span>
      <span className="opacity-60">%</span>
    </span>
  );
}

const formatTimecode = (seconds: number) => {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  const f = "00";
  return `${h}:${m}:${s}:${f}`;
};

export default SearchResultItem;
