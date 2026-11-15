import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBook } from "@fortawesome/free-solid-svg-icons";
import useLanguage from "../../hooks/UseLanguage.tsx";
import "./HeroProgressStats.scss";

interface HeroProgressStatsProps {
    ownedCount: number;
    totalCount: number;
    label?: string;
    className?: string;
}

export default function HeroProgressStats({
    ownedCount,
    totalCount,
    label,
    className = ""
}: HeroProgressStatsProps) {
    const { tr } = useLanguage();
    const progressPercent = totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0;

    return (
        <div className={`hero-progress-stats ${className}`.trim()}>
            <div className="hero-progress-stats__header">
                <span className="hero-progress-stats__label">
                    <FontAwesomeIcon icon={faBook} />
                    <span>{label ?? tr("Collection progress", "Progression dans votre collection")}</span>
                </span>
                <span className="hero-progress-stats__val">
                    <strong>{ownedCount}</strong> / {totalCount}{" "}
                    {ownedCount > 1 ? tr("owned", "possédés") : tr("owned", "possédé")} ({progressPercent}%)
                </span>
            </div>
            <div className="hero-progress-stats__bar">
                <div
                    className="hero-progress-stats__fill"
                    style={{ width: `${Math.min(100, progressPercent)}%` }}
                />
            </div>
        </div>
    );
}
