export default interface SeriesDTO {
	name: string;
	category: string;
	status: string;
	totalVolumes: number;
	
}

export function getSeriesStatusLabel(status: string): string | null {
	switch (status) {
		case "FINISHED":
			return "Terminé";
		case "ANNOUNCED":
			return "Annoncé";
		case "ON_GOING":
			return "En cours";
		case "CANCELLED":
			return "Annulé";
		default:
			return null;
	}
}
