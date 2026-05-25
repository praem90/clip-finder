import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useQuery } from '@tanstack/react-query';
import { VideoItem } from "@/components/video";
import { Video } from "@/types/video";
import { getVideos } from "@/services/api";

export function Media() {

	const { isPending, isError, data, error } = useQuery({
		queryKey: ['videos'],
		queryFn: getVideos,
	});

	if (isPending) return <div>Loading...</div>
	if (isError) return <div>Error: {error.message}</div>

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>Media</CardTitle>
				<CardDescription>
					Track performance and user engagement metrics. Monitor trends and
					identify growth opportunities.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-3 md:grid-cols-6 xl:grid-cols-9 2xl:grid-cols-12 gap-4">

					{data?.results.map((video: Video) => (
						<VideoItem key={video.id} video={video} />
					))}
				</div>
			</CardContent>
		</Card>
	)
}

export default Media;
