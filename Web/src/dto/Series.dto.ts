import BookSummaryDTO from "./BookSummary.dto.ts";

export default interface SeriesDTO {
	id: number;
	name: string;
	description?: string;
	category?: string;
	categoryId?: number;
	status: string;
	totalVolumes: number;
	coverUrl?: string;
	createdByUserId?: number;
	createdByUsername?: string;
	isFollowed?: boolean;
	ownedCount?: number;
	books?: BookSummaryDTO[];
}

export function getSeriesStatusLabel(status?: string | null): string {
	switch (status?.toUpperCase()) {
		case "FINISHED":
			return "Terminée";
		case "ANNOUNCED":
			return "Annoncée";
		case "ON_GOING":
			return "En cours";
		case "CANCELLED":
			return "Annulée";
		default:
			return status || "En cours";
	}
}
