import { useMemo, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Check, Plus, Search, X } from "lucide-react";

import { cn } from "#lib/utils";

const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// Stable color per tag name: same name → same hue everywhere.
function tagColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return {
    bg: `hsl(${hue} 60% 50% / 0.12)`,
    border: `hsl(${hue} 65% 60% / 0.5)`,
    text: `hsl(${hue} 80% 80%)`,
    dot: `hsl(${hue} 70% 60%)`,
  };
}

function TagChip({ tag, onRemove, busy }: { tag: string; onRemove?: () => void; busy?: boolean }) {
  const c = tagColor(tag);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm border py-0.5 pr-1 pl-1.5 font-mono text-[10px] tracking-wide"
      style={{ backgroundColor: c.bg, borderColor: c.border, color: c.text }}
    >
      {tag}
      {onRemove && (
        <button
          onClick={onRemove}
          disabled={busy}
          title={`Remove ${tag}`}
          className="opacity-50 transition-opacity hover:opacity-100 disabled:opacity-30"
          style={{ color: c.text }}
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

export function TagEditor({
  tags,
  allTags = [],
  onChange,
  busy,
}: {
  tags: string[];
  allTags?: string[];
  onChange: (tags: string[]) => void;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  // Work on a draft while the popover is open; commit when it closes (like GitHub).
  const [draft, setDraft] = useState<string[]>(tags);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(tags);
      setFilter("");
    } else {
      const changed =
        draft.length !== tags.length || draft.some((t) => !tags.some((x) => eq(x, t)));
      if (changed) onChange(draft);
    }
    setOpen(next);
  };

  const toggle = (tag: string) => {
    setDraft((d) => (d.some((t) => eq(t, tag)) ? d.filter((t) => !eq(t, tag)) : [...d, tag]));
  };

  const removeChip = (tag: string) => onChange(tags.filter((t) => !eq(t, tag)));

  const q = filter.trim();
  const known = useMemo(
    () => Array.from(new Set([...allTags, ...draft])).sort((a, b) => a.localeCompare(b)),
    [allTags, draft]
  );
  const options = q ? known.filter((t) => t.toLowerCase().includes(q.toLowerCase())) : known;
  const canCreate = q.length > 0 && !known.some((t) => eq(t, q));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <TagChip key={tag} tag={tag} onRemove={() => removeChip(tag)} busy={busy} />
      ))}

      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        <Popover.Trigger
          disabled={busy}
          className="inline-flex items-center gap-0.5 rounded-sm border border-dashed border-white/15 py-0.5 pr-1.5 pl-1 font-mono text-[10px] tracking-wide text-muted-foreground transition-colors hover:border-amber-400/50 hover:text-amber-200 disabled:opacity-40 data-[popup-open]:border-amber-400/50 data-[popup-open]:text-amber-200"
        >
          <Plus className="size-2.5" /> tag
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Positioner side="bottom" align="start" sideOffset={6}>
            <Popover.Popup
              className={cn(
                "z-50 w-60 overflow-hidden rounded-sm border border-white/10 bg-popover text-popover-foreground shadow-2xl shadow-black/50",
                "transition duration-150 data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95"
              )}
            >
              <div className="mono-label border-b border-white/8 px-3 py-2">Apply tags</div>

              <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
                <Search className="size-3.5 shrink-0 text-muted-foreground" />
                <input
                  autoFocus
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (canCreate) {
                        toggle(q);
                        setFilter("");
                      } else if (options[0]) {
                        toggle(options[0]);
                      }
                    }
                  }}
                  placeholder="Filter or create…"
                  className="h-5 flex-1 bg-transparent font-mono text-[11px] tracking-tight text-foreground outline-none placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="max-h-56 overflow-y-auto py-1">
                {options.map((tag) => {
                  const active = draft.some((t) => eq(t, tag));
                  const c = tagColor(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggle(tag)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[11px] tracking-tight transition-colors hover:bg-white/[0.04]"
                    >
                      <Check
                        className={cn("size-3.5 shrink-0 text-amber-400", active ? "opacity-100" : "opacity-0")}
                      />
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: c.dot }}
                      />
                      <span className={active ? "text-foreground" : "text-muted-foreground"}>{tag}</span>
                    </button>
                  );
                })}

                {canCreate && (
                  <button
                    onClick={() => {
                      toggle(q);
                      setFilter("");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[11px] tracking-tight text-muted-foreground transition-colors hover:bg-white/[0.04]"
                  >
                    <Plus className="size-3.5 shrink-0 text-amber-400" />
                    Create
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tagColor(q).dot }}
                    />
                    <span className="text-foreground">“{q}”</span>
                  </button>
                )}

                {options.length === 0 && !canCreate && (
                  <div className="px-3 py-3 font-mono text-[11px] text-muted-foreground/60">no tags yet</div>
                )}
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
