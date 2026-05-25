import { Card } from "@/components/ui/card"
import { CardDescription, CardTitle } from "./ui/card";
import { SearchResult } from "@/types/video";

export function SearchResultItem({ result }: { result: SearchResult }) {
	return (
		<Card>
			<img src={getUrl(result)} alt={result.video.name} className="w-full h-auto rounded-t-xl" />
			<CardTitle>{result.video.name}</CardTitle>
			<CardDescription>
				Timestamp: {result.timestamp}
			</CardDescription>
		</Card>
	)
}

const getUrl = (result: SearchResult) => {
	return `http://localhost:8000/frame?video_id=${result.video.id}&timestamp=${result.timestamp}`;
}

export default SearchResultItem;

