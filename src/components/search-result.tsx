import { SearchResult } from "@/types/video";
import { startDrag } from '@crabnebula/tauri-plugin-drag';
import { resolveResource } from "@tauri-apps/api/path";

const iconPath = await resolveResource('icons/32x32.png');

export function SearchResultItem({ result, rank }: { result: SearchResult; rank?: number }) {
	const name = result.video.path.split('/').slice(-1)[0];
	const score = Math.round((result.confidence ?? 0) * 100);

	const dragClip = async (e: React.DragEvent) => {
		e.preventDefault();
		startDrag({
			item: [result.video.path],
			icon: iconPath,
		});
	}

	return (
		<div
			draggable
			onDragStart={dragClip}
			className="group corner-marks relative flex cursor-grab flex-col gap-2 active:cursor-grabbing"
		>
			<div className="relative aspect-video w-full overflow-hidden bg-white/[0.02] ring-1 ring-white/8 transition-all duration-200 group-hover:ring-amber-400/60">
				<img
					src={getUrl(result)}
					alt={result.video.name}
					className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
					loading="lazy"
				/>
				<div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

				<div className="absolute top-2 left-2 flex items-center gap-1 font-mono text-[10px] tracking-wider text-white/80">
					{typeof rank === "number" && (
						<span className="rounded-sm bg-black/70 px-1 py-0.5 backdrop-blur-sm">#{rank.toString().padStart(2, "0")}</span>
					)}
				</div>

				<div className="absolute top-2 right-2">
					<ScorePill score={score} />
				</div>

				<div className="absolute right-2 bottom-2 left-2 flex items-end justify-between gap-2">
					<span className="rounded-sm bg-black/80 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-amber-300 backdrop-blur-sm">
						TC {formatTimecode(result.timestamp)}
					</span>
				</div>
			</div>

			<div className="px-0.5">
				<div className="truncate font-mono text-[11px] tracking-tight text-foreground" title={name}>
					{name}
				</div>
			</div>
		</div>
	)
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

const getUrl = (result: SearchResult) => {
	return `http://localhost:58000/frame?video_id=${result.video.id}&timestamp=${result.timestamp}`;
}

const formatTimecode = (seconds: number) => {
	const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
	const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
	const s = Math.floor(seconds % 60).toString().padStart(2, '0');
	const f = "00";
	return `${h}:${m}:${s}:${f}`;
};

export default SearchResultItem;
