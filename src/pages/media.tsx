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
import { useEffect } from "react";
import { indexVideo } from "../services/api";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "#components/ui/table";
import IndexStatus from "#components/index-status";
import { toast } from "sonner";


export function Media() {
	const { isPending, isError, data, error } = useQuery({
		queryKey: ['videos'],
		queryFn: getVideos,
	});

	useEffect(() => {
		const handleFileDrop = async (e) => {
			console.log('File dropped:', e);
			try {
				await indexVideo({ videoPath: e.detail });
				toast.success('Video indexed successfully!');
			} catch (err) {
				console.error('Error indexing video:', err);
				toast.error(`Failed to index video: ${err.message}`);
			}
		};
		window.addEventListener('tauri-file-dropped', handleFileDrop);

		return () => {
			window.removeEventListener('tauri-file-dropped', handleFileDrop);
		};

	}, []);

	if (isPending) return <div>Loading...</div>
	if (isError) return <div>Error: {error.message}</div>

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>Media</CardTitle>
				<CardDescription>
					List of all indexed videos. Drag and drop new video files to add them to the library.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableCell>Video Name</TableCell>
							<TableCell>Location</TableCell>
							<TableCell>Duration</TableCell>
							<TableCell>Status</TableCell>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data?.results.map((video: Video) => (
							<TableRow key={video.id}>
								<TableCell>{video.path.split('/').slice(-1)[0]}</TableCell>
								<TableCell>{video.path.split('/').slice(0, -1).join('/')}</TableCell>
								<TableCell>-</TableCell>
								<TableCell><IndexStatus status={video.status} /></TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	)
}

export default Media;
