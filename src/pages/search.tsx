import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useQuery } from '@tanstack/react-query';
import { SearchResultItem } from "@/components/search-result";
import { searchVideos } from "../services/api";
import { SearchResult } from "@/types/video";
import { useState } from "react";


export function Search() {
	const [query, setQuery] = useState("");
	const { isPending, isError, data, error } = useQuery({
		queryKey: ['searchResults', query],
		queryFn: () => searchVideos({ query }),
		enabled: query.trim() !== "", // Only run the query if the search term is not empty
	});


	return (
		<div className="h-full">
			<Input onChange={(e) => setQuery(e.target.value)} placeholder="Search for videos..." className="mb-4" />
			<Card className="h-full">
				<CardHeader>
					<CardTitle>Seach Results</CardTitle>
					<CardDescription>
						Track performance and user engagement metrics. Monitor trends and
						identify growth opportunities.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{(isPending) && <div>Loading...</div>}
					{(isError) && <div>Error: {error?.message}</div>}
					{data?.results.length === 0 && <div>No results found.</div>}
					<div className="grid grid-cols-3 md:grid-cols-6 xl:grid-cols-9 2xl:grid-cols-12 gap-4">

						{data?.results.map((result: SearchResult) => (
							<SearchResultItem key={`${result.video.id}-${result.timestamp}`} result={result} />
						))}
					</div>
				</CardContent>
			</Card >
		</div>
	)
}

export default Search;
