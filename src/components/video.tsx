import { Card } from "@/components/ui/card"
import { CardDescription, CardTitle } from "./ui/card";
import { Video } from "../types/video";

export function VideoItem({ video }: { video: Video }) {
	return (
		<Card>
			<img src="https://placehold.co/600x400" alt={video.name} className="w-full h-auto rounded-t-xl" />
			<CardTitle>{video.name}</CardTitle>
			<CardDescription>
				Status: {video.status}
			</CardDescription>
		</Card>
	)
}

export default VideoItem;
