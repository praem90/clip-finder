import { Status } from "../types/video";
import { Badge } from "./ui/badge";

const bgColorMap = {
	[Status.PENDING]: "bg-yellow-500",
	[Status.PROCESSING]: "bg-blue-500",
	[Status.COMPLETED]: "bg-green-500",
	[Status.FAILED]: "bg-red-500",
}

const textColorMap = {
	[Status.PENDING]: "text-yellow-950",
	[Status.PROCESSING]: "text-blue-950",
	[Status.COMPLETED]: "text-green-950",
	[Status.FAILED]: "text-red-950",
}

const IndexStatus = ({ status }) => {

	const statusText = Object.entries(Status).find(([value, key]) => key === status)?.[0] || "Unknown";
	return (<Badge className={`${bgColorMap[status]} ${textColorMap[status]}`} > {statusText}</Badge >);
}

export default IndexStatus;
