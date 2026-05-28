import { Status } from "../types/video";

const styleMap: Record<Status, { label: string; dot: string; text: string; border: string; pulse: boolean }> = {
	[Status.PENDING]: {
		label: "PENDING",
		dot: "bg-white/40",
		text: "text-white/70",
		border: "border-white/10",
		pulse: false,
	},
	[Status.PROCESSING]: {
		label: "PROC···",
		dot: "bg-amber-400",
		text: "text-amber-200",
		border: "border-amber-400/40",
		pulse: true,
	},
	[Status.COMPLETED]: {
		label: "INDEXED",
		dot: "bg-emerald-400",
		text: "text-emerald-200",
		border: "border-emerald-400/30",
		pulse: false,
	},
	[Status.FAILED]: {
		label: "FAILED",
		dot: "bg-rose-400",
		text: "text-rose-200",
		border: "border-rose-400/40",
		pulse: false,
	},
};

const IndexStatus = ({ status }: { status: Status }) => {
	const s = styleMap[status] ?? styleMap[Status.PENDING];
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] tracking-wider ${s.text} ${s.border}`}
		>
			<span className={`size-1.5 rounded-full ${s.dot} ${s.pulse ? "amber-dot" : ""}`} />
			{s.label}
		</span>
	);
}

export default IndexStatus;
