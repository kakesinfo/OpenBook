import type { ReactNode } from "react";
import "./PageControls.scss";

interface PageControlsProps {
    left?: ReactNode;
    center?: ReactNode;
    right?: ReactNode;
    bottom?: ReactNode;
    className?: string;
}

export default function PageControls({
    left,
    center,
    right,
    bottom,
    className = ""
}: PageControlsProps) {
    return (
        <div className={`shared-page-controls ${className}`.trim()}>
            <div className="shared-page-controls__main">
                {left && <div className="shared-page-controls__left">{left}</div>}
                {center && <div className="shared-page-controls__center">{center}</div>}
                {right && <div className="shared-page-controls__right">{right}</div>}
            </div>
            {bottom && <div className="shared-page-controls__bottom">{bottom}</div>}
        </div>
    );
}
