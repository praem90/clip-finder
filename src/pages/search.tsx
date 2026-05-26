import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useQuery } from '@tanstack/react-query';
import { SearchResultItem } from "@/components/search-result";
import { searchVideos } from "../services/api";
import { SearchResult } from "@/types/video";
import { useState } from "react";
import { Field } from "@/components/ui/field";
import useDebounce from "#hooks/debounce";

export function Search() {
	const [query, setQuery] = useState("");
	const debouncedQuery = useDebounce(query, 500); // Debounce the search input by 500ms

	const { isPending, isError, data, error } = useQuery({
		queryKey: ['searchResults', debouncedQuery],
		queryFn: () => searchVideos({ query }),
		enabled: debouncedQuery.trim() !== "", // Only run the query if the search term is not empty

	});

	return (
		<div className="h-full">
			<Card className="h-full">
				<CardHeader>
					<CardTitle>Seach</CardTitle>
				</CardHeader>
				<CardContent>
					<Field>
						<Input onChange={(e) => setQuery(e.target.value)} placeholder="Search for videos..." className="mb-4" />
					</Field>
					{query.trim() === "" ? <div>Please enter a search term to find videos.</div> : (
						<>
							{(isPending) && <div>Loading...</div>}
							{(isError) && <div>Error: {error?.message}</div>}
							{data?.results.length === 0 && <div>No results found.</div>}
							<div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-9 gap-4">

								{data?.results.map((result: SearchResult) => (
									<SearchResultItem key={`${result.video.id}-${result.timestamp}`} result={result} />
								))}
							</div>
						</>
					)}
				</CardContent>
			</Card >
		</div>
	)
}

export default Search;
