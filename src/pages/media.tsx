import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Video } from "@/types/video";
import { getVideos } from "@/services/api";
import { useEffect, useState } from "react";
import { deleteVideo, indexVideo, reIndexVideo } from "../services/api";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "#components/ui/table";
import IndexStatus from "#components/index-status";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Spinner } from "#components/ui/spinner";
import { open } from '@tauri-apps/plugin-dialog';



export function Media() {
	const { isPending, isError, data, error } = useQuery({
		queryKey: ['videos'],
		queryFn: getVideos,
	});

	const queryClient = useQueryClient()

	const pickFiles = async () => {
		const files = await open({
			multiple: true,
			directory: false,
		});

		if (!files) return; // User cancelled the file picker

		files.forEach((path: string) => {
			const dropEvent = new CustomEvent('tauri-file-dropped', {
				detail: path
			});
			window.dispatchEvent(dropEvent);
		});
	};

	useEffect(() => {
		const handleFileDrop = async (e: CustomEvent<string> | Event) => {
			if (!(e instanceof CustomEvent)) {
				return;
			}

			if (!e.detail) {
				return;
			}

			const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv'];
			const allowed = allowedExtensions.some(ext => e.detail.toLowerCase().endsWith(ext));
			if (!allowed) {
				toast.error('Unsupported file type. Please drop a video file.');
				return;
			}

			try {
				if (e.detail?.indexOf('.mp4') === -1) {
					toast.error('No file path provided for indexing.');
					return;
				}
				await indexVideo({ path: e.detail });
				toast.success('Video indexed successfully!');
			} catch (err: any) {
				toast.error(`Failed to index video: ${err.message}`);
			} finally {
				// Invalidate the videos query to refresh the list after indexing
				queryClient.invalidateQueries({ queryKey: ['videos'] });
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
			<CardHeader className="flex justify-between items-center">
				<div >
					<CardTitle>Media</CardTitle>
					<CardDescription>
						List of all indexed videos. Drag and drop new video files to add them to the library.
					</CardDescription>
				</div>
				<Button variant="outline" onClick={pickFiles}><Plus /> Add</Button>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableCell>Video Name</TableCell>
							<TableCell>Location</TableCell>
							<TableCell>Last Indexed At</TableCell>
							<TableCell>Status</TableCell>
							<TableCell>Action</TableCell>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data?.results.map((video: Video) => (
							<MediaRow key={video.id} video={video} />
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	)
}

export function MediaRow({ video }: { video: Video }) {
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

	return (
		<TableRow key={video.id}>
			<TableCell>{video.path.split('/').slice(-1)[0]}</TableCell>
			<TableCell>{video.path.split('/').slice(0, -1).join('/')}</TableCell>
			<TableCell>{new Date(video.lastIndexedAt).toLocaleDateString()} {new Date(video.lastIndexedAt).toLocaleTimeString()}</TableCell>
			<TableCell><IndexStatus status={video.status} /></TableCell>
			<TableCell className="space-x-2">
				<Button variant="outline" size="icon" onClick={reIndex}>
					{reIndexing ? <Spinner /> : <RefreshCw />}
				</Button>
				<Button variant="destructive" size="icon" onClick={handleDelete} disabled={deleting}>
					{deleting ? <Spinner /> : <Trash2 />}
				</Button>
			</TableCell>
		</TableRow>

	);
};

export default Media;
