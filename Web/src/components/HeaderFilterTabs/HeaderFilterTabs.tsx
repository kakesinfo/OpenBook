import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "./HeaderFilterTabs.scss";

export interface HeaderFilterTab<T extends string = string> {
    id: T;
    label: string;
    icon?: IconDefinition;
    count?: number | string;
}

interface HeaderFilterTabsProps<T extends string = string> {
    tabs: HeaderFilterTab<T>[];
    selectedId: T;
    onChange: (id: T) => void;
    className?: string;
}

export default function HeaderFilterTabs<T extends string = string>({
    tabs,
    selectedId,
    onChange,
    className = ""
}: HeaderFilterTabsProps<T>) {
    return (
        <div className={`header-filter-tabs-wrapper ${className}`.trim()}>
            <div className="header-filter-tabs">
                {tabs.map((tab) => {
                    const isSelected = selectedId === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onChange(tab.id)}
                            className={`header-filter-tabs__btn ${isSelected ? "is-active" : ""}`}
                        >
                            {tab.icon && <FontAwesomeIcon icon={tab.icon} />}
                            <span>{tab.label}</span>
                            {tab.count !== undefined && (
                                <span className="header-filter-tabs__count">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
