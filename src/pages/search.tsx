import { Input } from "@/components/ui/input";
import { useQuery } from '@tanstack/react-query';
import { SearchResultItem } from "@/components/search-result";
import { searchVideos } from "../services/api";
import { SearchResult } from "@/types/video";
import { useState } from "react";
import useDebounce from "#hooks/debounce";
import { ArrowRight } from "lucide-react";

const PROMPTS = [
  "a person walking on the beach at sunset",
  "close-up of hands typing on a keyboard",
  "city skyline at night",
  "a dog running through grass",
];

export function Search() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 500);

  const { isPending, isError, data, error } = useQuery({
    queryKey: ['searchResults', debouncedQuery.trim()],
    queryFn: () => searchVideos({ query: debouncedQuery.trim() }),
    enabled: debouncedQuery.trim() !== "",
  });

  const hasQuery = query.trim() !== "";
  const resultCount = data?.results.length ?? 0;
  const isLoading = hasQuery && isPending;

  return (
    <div className="flex h-full flex-col">
      <header className="hairline-b shrink-0 px-8 pt-6 pb-5">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="mono-label">PAGE / 01</span>
            <h1 className="font-heading text-xl font-medium tracking-tight">Search</h1>
          </div>
          <StatusReadout
            query={query}
            loading={isLoading}
            error={isError}
            count={resultCount}
          />
        </div>

        <div className="mt-5">
          <div className="group flex items-center gap-3 border-b border-white/10 pb-2 transition-colors focus-within:border-amber-400/70">
            <span className="font-mono text-[11px] tracking-[0.2em] text-amber-400">QUERY ▸</span>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="describe a scene, object, or moment…"
              autoFocus
              className="h-9 flex-1 rounded-none border-0 bg-transparent px-0 font-mono text-[15px] tracking-tight shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:outline-none"
            />
            {!hasQuery && <span className="caret-blink h-4 w-px bg-foreground" aria-hidden />}
            {hasQuery && (
              <button
                onClick={() => setQuery("")}
                className="font-mono text-[10px] tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              >
                CLEAR
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!hasQuery ? (
          <HeroState onPick={setQuery} />
        ) : isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ConsoleLine tone="error">err: {error?.message ?? "unknown failure"}</ConsoleLine>
        ) : resultCount === 0 ? (
          <ConsoleLine tone="muted">0 matches for "{debouncedQuery.trim()}". try a broader description.</ConsoleLine>
        ) : (
          <div className="px-8 py-6">
            <div className="grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {data?.results.map((result: SearchResult, idx: number) => (
                <SearchResultItem
                  key={`${result.video.id}-${result.timestamp}`}
                  result={result}
                  rank={idx + 1}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusReadout({
  query,
  loading,
  error,
  count,
}: {
  query: string;
  loading: boolean;
  error: boolean;
  count: number;
}) {
  if (!query.trim()) {
    return <span className="mono-label">awaiting input</span>;
  }
  if (loading) {
    return (
      <span className="flex items-center gap-2 font-mono text-[10px] tracking-wider text-amber-400">
        <span className="size-1.5 rounded-full bg-amber-400 amber-dot" />
        SCANNING
      </span>
    );
  }
  if (error) {
    return <span className="font-mono text-[10px] tracking-wider text-rose-400">// FAULT</span>;
  }
  return (
    <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
      <span className="text-foreground">{count.toString().padStart(3, "0")}</span> / matches
    </span>
  );
}

function HeroState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="grid h-full place-items-center px-8 py-12">
      <div className="flex w-full max-w-2xl flex-col items-start gap-8">
        <div>
          <div className="mono-label mb-3">// INSTRUCTIONS</div>
          <h2 className="font-heading text-2xl leading-tight font-medium tracking-tight">
            Type a description.
            <br />
            <span className="text-muted-foreground">Find the exact frame.</span>
          </h2>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            clipfinder embeds every two seconds of your video library and matches your prompt against the closest frames using cosine similarity.
          </p>
        </div>

        <div className="w-full">
          <div className="mono-label mb-2">try one of these</div>
          <div className="flex flex-wrap gap-2">
            {PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => onPick(p)}
                className="group inline-flex items-center gap-1.5 rounded-sm border border-white/8 bg-white/[0.02] px-2.5 py-1.5 font-mono text-[11px] tracking-tight text-muted-foreground transition-colors hover:border-amber-400/60 hover:bg-white/[0.04] hover:text-foreground"
              >
                <span>{p}</span>
                <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>

        <div className="hairline-t mono-label w-full pt-4">
          tip · drag results out of the window to drop into Premiere, Resolve, or Finder.
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="px-8 py-6">
      <div className="grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div
              className="aspect-video w-full animate-pulse rounded-sm bg-white/[0.04]"
              style={{ animationDelay: `${i * 80}ms` }}
            />
            <div className="h-2.5 w-3/4 animate-pulse rounded-sm bg-white/[0.03]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ConsoleLine({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "error" }) {
  const color = tone === "error" ? "text-rose-300" : "text-muted-foreground";
  return (
    <div className="px-8 py-10">
      <div className={`font-mono text-xs tracking-tight ${color}`}>
        <span className="mr-2 text-amber-400">$</span>
        {children}
      </div>
    </div>
  );
}

export default Search;
