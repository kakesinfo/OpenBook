export default interface SeriesDTO {
	id?: number;
	name: string;
	category: string;
	status: string;
	totalVolumes: number;
}

export function getSeriesStatusLabel(status: string): string | null {
	switch (status) {
		case "FINISHED":
			return "Terminée";
		case "ANNOUNCED":
			return "Annoncée";
		case "ON_GOING":
			return "En cours";
		case "CANCELLED":
			return "Annulée";
		default:
			return null;
	}
}
