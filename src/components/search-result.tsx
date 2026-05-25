import { Card } from "@/components/ui/card"
import { CardDescription, CardHeader, CardTitle } from "./ui/card";
import { SearchResult } from "@/types/video";
import { Badge } from "./ui/badge";
import { startDrag } from '@crabnebula/tauri-plugin-drag';
import { resolveResource } from "@tauri-apps/api/path";

const iconPath = await resolveResource('icons/32x32.png'); // Example icon path, adjust as needed

export function SearchResultItem({ result }: { result: SearchResult }) {
	const name = result.video.path.split('/').slice(-1)[0];
	const score = Math.round((result._distance ?? 0) * 100);
	console.log(iconPath);
	const dragClip = async (e: React.DragEvent) => {
		e.preventDefault();

		startDrag({
			item: [result.video.path],
			icon: iconPath, // Optional: Set a custom icon for the drag operation
			// title: `${name} @ ${formatTimecode(result.timestamp)} (Score: ${score}%)`
		});
	}
	return (
		<Card className="relative" draggable onDragStart={dragClip}>
			<img src={getUrl(result)} alt={result.video.name} className="w-full h-auto rounded-t-xl" />
			<Badge className={`absolute top-2 right-2 rounded-full px-2 ${scoreToTextColor(result._distance ?? 0)} ${scoreToBgColor(result._distance ?? 0)}`} title={`Relevance Score: ${score}%`}>{score}%</Badge>
			<CardHeader>
				<CardTitle>{name}</CardTitle>
				<CardDescription>
					{formatTimecode(result.timestamp)}
				</CardDescription>
			</CardHeader>
		</Card >
	)
}

const getUrl = (result: SearchResult) => {
	return `http://localhost:8000/frame?video_id=${result.video.id}&timestamp=${result.timestamp}`;
}

const formatTimecode = (seconds: number) => {
	const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
	const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
	const s = Math.floor(seconds % 60).toString().padStart(2, '0');
	const f = "00"; // Assuming 0 frames for the MVP, or calculate based on FPS
	return `${h}:${m}:${s}:${f}`;
};

const scoreToBgColor = (score: number) => {
	if (score >= 0.7) return "bg-green-500";
	if (score >= 0.5) return "bg-yellow-500";
	return "bg-red-500";
}

const scoreToTextColor = (score: number) => {
	if (score >= 0.7) return "text-green-950";
	if (score >= 0.5) return "text-yellow-950";
	return "text-red-950";
}

export default SearchResultItem;

