import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Video, Status } from "@/types/video";
import { getVideos } from "@/services/api";
import { useEffect, useMemo, useState } from "react";
import { deleteVideo, indexVideo, reIndexVideo } from "../services/api";
import IndexStatus from "#components/index-status";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Trash2, FileVideo, Inbox, FolderOpen } from "lucide-react";
import { Spinner } from "#components/ui/spinner";
import { open } from '@tauri-apps/plugin-dialog';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { listen } from '@tauri-apps/api/event';

type IndexProgress = { processed: number; total: number };

export function Media() {
  const { isPending, isError, data, error } = useQuery({
    queryKey: ['videos'],
    queryFn: getVideos,
    // Poll while anything is still indexing so the table updates live.
    refetchInterval: (query) => {
      const vids = query.state.data?.results ?? [];
      return vids.some((v) => v.status === Status.PROCESSING || v.status === Status.PENDING)
        ? 2000
        : false;
    },
  });

  const queryClient = useQueryClient()
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<Record<string, IndexProgress>>({});

  // Live per-frame indexing progress streamed from the Rust indexer.
  useEffect(() => {
    const unlisten = listen<{ video_id: string; processed: number; total: number }>(
      'index-progress',
      (e) => {
        const { video_id, processed, total } = e.payload;
        setProgress((prev) => ({ ...prev, [video_id]: { processed, total } }));
        // index_video only returns once fully done, so the row would otherwise
        // stay invisible until completion. The first frame's event surfaces it
        // as "processing" (and bootstraps refetchInterval polling) — after which
        // the bar animates live off these events.
        const cached = queryClient.getQueryData<{ results: Video[] }>(['videos']);
        const v = cached?.results.find((x) => x.id === video_id);
        if (!v || v.status !== Status.PROCESSING) {
          queryClient.invalidateQueries({ queryKey: ['videos'] });
        }
      },
    );
    return () => { unlisten.then((fn) => fn()); };
  }, [queryClient]);

  const pickFiles = async () => {
    const files = await open({
      multiple: true,
      directory: false,
    });

    if (!files) return;

    files.forEach((path: string) => {
      const dropEvent = new CustomEvent('tauri-file-dropped', {
        detail: path
      });
      window.dispatchEvent(dropEvent);
    });
  };

  useEffect(() => {
    const handleFileDrop = async (e: CustomEvent<string> | Event) => {
      if (!(e instanceof CustomEvent)) return;
      if (!e.detail) return;

      const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv'];
      const allowed = allowedExtensions.some(ext => e.detail.toLowerCase().endsWith(ext));
      if (!allowed) {
        toast.error('Unsupported file type. Please drop a video file.');
        return;
      }

      try {
        await indexVideo({ path: e.detail });
        toast.success('Video indexed successfully!');
      } catch (err: any) {
        toast.error(`Failed to index video: ${err.message}`);
      } finally {
        queryClient.invalidateQueries({ queryKey: ['videos'] });
      }
    };
    window.addEventListener('tauri-file-dropped', handleFileDrop);

    return () => {
      window.removeEventListener('tauri-file-dropped', handleFileDrop);
    };
  }, []);

  useEffect(() => {
    const onEnter = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const onLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setIsDragging(false);
    };
    const onDrop = () => setIsDragging(false);
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const videos = data?.results ?? [];
  const stats = useMemo(() => {
    const counts = { total: videos.length, indexed: 0, processing: 0, pending: 0 };
    videos.forEach((v: Video) => {
      if (v.status === Status.COMPLETED) counts.indexed++;
      else if (v.status === Status.PROCESSING) counts.processing++;
      else counts.pending++;
    });
    return counts;
  }, [videos]);

  return (
    <div className="relative flex h-full flex-col">
      <header className="hairline-b shrink-0 px-8 pt-6 pb-5">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="mono-label">PAGE / 02</span>
            <h1 className="font-heading text-xl font-medium tracking-tight">Library</h1>
          </div>
          <Button
            onClick={pickFiles}
            className="h-8 rounded-sm border border-amber-400/40 bg-amber-400/10 px-3 font-mono text-[11px] tracking-wider text-amber-200 shadow-none hover:bg-amber-400/20"
          >
            <Plus className="size-3.5" /> ADD MEDIA
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-white/8 bg-white/5">
          <StatCell label="total" value={stats.total} />
          <StatCell label="indexed" value={stats.indexed} accent />
          <StatCell
            label="processing"
            value={stats.processing}
            pulse={stats.processing > 0}
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isPending ? (
          <div className="grid place-items-center py-20">
            <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-muted-foreground">
              <Spinner /> LOADING LIBRARY…
            </div>
          </div>
        ) : isError ? (
          <div className="mx-8 my-6 border-l-2 border-rose-400/60 bg-rose-500/[0.06] px-4 py-3 font-mono text-xs text-rose-200">
            err: {error.message}
          </div>
        ) : videos.length === 0 ? (
          <EmptyState onAdd={pickFiles} />
        ) : (
          <MediaTable videos={videos} progress={progress} />
        )}
      </div>

      {isDragging && (
        <div className="pointer-events-none absolute inset-4 z-50 grid place-items-center border-2 border-dashed border-amber-400/80 bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 font-mono text-amber-200">
            <Inbox className="size-8" />
            <span className="text-sm tracking-wider">RELEASE TO INDEX</span>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCell({ label, value, accent, pulse }: { label: string; value: number; accent?: boolean; pulse?: boolean }) {
  return (
    <div className="bg-background px-4 py-3">
      <div className="mono-label">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`font-mono text-2xl leading-none tabular-nums ${accent ? "text-amber-400" : "text-foreground"}`}>
          {value.toString().padStart(2, "0")}
        </span>
        {pulse && <span className="size-1.5 rounded-full bg-amber-400 amber-dot" />}
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="grid h-full place-items-center px-8 py-16">
      <div className="flex max-w-md flex-col items-start gap-4">
        <div className="mono-label">// LIBRARY EMPTY</div>
        <h2 className="font-heading text-2xl font-medium tracking-tight">
          Nothing indexed yet.
        </h2>
        <p className="text-sm text-muted-foreground">
          Drop a video anywhere in the window, or pick a file manually. We accept <code className="font-mono text-foreground">.mp4 .mov .avi .mkv .webm .flv</code>.
        </p>
        <Button
          onClick={onAdd}
          variant="outline"
          className="mt-2 h-9 rounded-sm border-amber-400/40 bg-amber-400/10 font-mono text-[11px] tracking-wider text-amber-200 hover:bg-amber-400/20"
        >
          <Plus className="size-3.5" /> ADD A FILE
        </Button>
      </div>
    </div>
  );
}

function MediaTable({ videos, progress }: { videos: Video[]; progress: Record<string, IndexProgress> }) {
  return (
    <div className="px-8 py-5">
      <div className="overflow-hidden rounded-sm border border-white/6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/6 bg-white/[0.02]">
              <th className="mono-label px-3 py-2.5 text-left">#</th>
              <th className="mono-label px-3 py-2.5 text-left">File</th>
              <th className="mono-label px-3 py-2.5 text-left">Path</th>
              <th className="mono-label px-3 py-2.5 text-left whitespace-nowrap">Last Indexed</th>
              <th className="mono-label px-3 py-2.5 text-left">Status</th>
              <th className="mono-label px-3 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((video, idx) => (
              <MediaRow key={video.id} video={video} idx={idx + 1} progress={progress[video.id]} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MediaRow({ video, idx, progress }: { video: Video; idx: number; progress?: IndexProgress }) {
  const [deleting, setDeleting] = useState(false);
  const [reIndexing, setReIndexing] = useState(false);
  const queryClient = useQueryClient()

  const reIndex = () => {
    setReIndexing(true);
    reIndexVideo(video.id).then(() => {
      toast.success('Video re-indexed successfully!');
    }).catch((err) => {
      toast.error(`Failed to re-index video: ${err.message}`);
    }).finally(() => {
      setReIndexing(false);
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    });
  };

  const handleDelete = () => {
    setDeleting(true);
    deleteVideo(video.id).then(() => {
      toast.success('Video deleted successfully!');
    }).catch((err) => {
      toast.error(`Failed to delete video: ${err.message}`);
    }).finally(() => {
      setDeleting(false);
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    });
  }

  const reveal = () => {
    revealItemInDir(video.path).catch((err) => {
      toast.error(`Failed to reveal file: ${err.message ?? err}`);
    });
  };

  const fileName = video.path.split('/').slice(-1)[0];
  const directory = video.path.split('/').slice(0, -1).join('/');
  const indexedDate = video.last_indexed_at ? new Date(video.last_indexed_at) : null;
  const indexedValid = indexedDate && !isNaN(indexedDate.getTime());

  return (
    <tr className="group/row border-t border-white/5 transition-colors hover:bg-white/[0.025]">
      <td className="relative px-3 py-3 font-mono text-[11px] text-muted-foreground tabular-nums">
        <span className="absolute left-0 top-0 h-full w-px bg-amber-400 opacity-0 transition-opacity group-hover/row:opacity-100" />
        {idx.toString().padStart(2, "0")}
      </td>
      <td className="max-w-[280px] px-3 py-3">
        <div className="flex items-center gap-2">
          <FileVideo className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-[13px]" title={fileName}>{fileName}</span>
        </div>
      </td>
      <td className="max-w-[320px] truncate px-3 py-3 font-mono text-[11px] text-muted-foreground" title={directory}>
        {directory}
      </td>
      <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap tabular-nums">
        {indexedValid
          ? `${indexedDate!.toLocaleDateString()} · ${indexedDate!.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : "—"}
      </td>
      <td className="px-3 py-3">
        <IndexStatus status={video.status} />
        {video.status === Status.PROCESSING && progress && (
          <ProgressBar processed={progress.processed} total={progress.total} />
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex justify-end gap-1.5">
          <button
            onClick={reveal}
            title="Reveal in Finder"
            className="grid size-7 place-items-center rounded-sm border border-white/8 text-muted-foreground transition-colors hover:border-amber-400/60 hover:bg-amber-400/[0.06] hover:text-amber-200"
          >
            <FolderOpen className="size-3.5" />
          </button>
          <button
            onClick={reIndex}
            title="Re-index"
            className="grid size-7 place-items-center rounded-sm border border-white/8 text-muted-foreground transition-colors hover:border-amber-400/60 hover:bg-amber-400/[0.06] hover:text-amber-200"
          >
            {reIndexing ? <Spinner /> : <RefreshCw className="size-3.5" />}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Delete"
            className="grid size-7 place-items-center rounded-sm border border-white/8 text-muted-foreground transition-colors hover:border-rose-400/60 hover:bg-rose-500/[0.06] hover:text-rose-200 disabled:opacity-50"
          >
            {deleting ? <Spinner /> : <Trash2 className="size-3.5" />}
          </button>
        </div>
      </td>
    </tr>
  );
}

function ProgressBar({ processed, total }: { processed: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : null;
  return (
    <div className="mt-1.5 w-28">
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full bg-amber-400 transition-all duration-300 ${pct === null ? "animate-pulse w-1/3" : ""}`}
          style={pct !== null ? { width: `${pct}%` } : undefined}
        />
      </div>
      <div className="mt-1 font-mono text-[9px] tracking-wider text-muted-foreground tabular-nums">
        {pct !== null ? `${processed}/${total} · ${pct}%` : `${processed} frames`}
      </div>
    </div>
  );
}

export default Media;
