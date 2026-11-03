import './LogBookCard.scss';
import { useNavigate } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import SeriesDTO, { getSeriesStatusLabel } from "../../dto/Series.dto.ts";
import useLanguage from "../../hooks/UseLanguage.tsx";

type Props = {
    series: SeriesDTO;
    onClose?: () => void;
};

export default function LogSeriesCard({ series, onClose }: Props) {
    const navigate = useNavigate();
    const { tr, translateCategory } = useLanguage();

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        onClose?.();
        navigate(`/app/series/${series.id}`);
    };

    return (
        <li className="logbook-card" onClick={handleClick}>
            <div className="logbook-card__thumbnail">
                {series.coverUrl ? (
                    <img src={series.coverUrl} alt={series.name} loading="lazy" decoding="async" />
                ) : (
                    <FontAwesomeIcon icon={faLayerGroup} />
                )}
            </div>

            <div className="logbook-card__content">
                <span className="logbook-card__badge logbook-card__badge--series">
                    {tr("Series", "Série")} {series.category ? `• ${translateCategory(series.category)}` : ""}
                </span>
                <h4 className="logbook-card__title" title={series.name}>
                    {series.name}
                </h4>
                <div className="logbook-card__meta">
                    {series.totalVolumes > 0 && (
                        <span className="logbook-card__volume">
                            {series.totalVolumes} {tr(series.totalVolumes > 1 ? "volumes" : "volume", `tome${series.totalVolumes > 1 ? "s" : ""}`)}
                        </span>
                    )}
                    {series.status && (
                        <span className="logbook-card__date">
                            {getSeriesStatusLabel(series.status)}
                        </span>
                    )}
                </div>
            </div>

            <div className="logbook-card__action">
                <span className="logbook-card__arrow">
                    <FontAwesomeIcon icon={faArrowRight} />
                </span>
            </div>
        </li>
    );
}
