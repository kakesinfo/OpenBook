import BookSummaryDTO from "./BookSummary.dto.ts";
import { getCurrentLanguage } from "../i18n";

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
	const isFr = getCurrentLanguage() === "fr";
	switch (status?.toUpperCase()) {
		case "FINISHED":
			return isFr ? "Terminée" : "Completed";
		case "ANNOUNCED":
			return isFr ? "Annoncée" : "Announced";
		case "ON_GOING":
			return isFr ? "En cours" : "Ongoing";
		case "CANCELLED":
			return isFr ? "Annulée" : "Cancelled";
		default:
			return status || (isFr ? "En cours" : "Ongoing");
	}
}
