import { CSSProperties, ReactNode } from "react";
import "./Container.scss";

export default function Container({ style, children }: { style?: CSSProperties, children: ReactNode }) {
    return (
        <div className="container" style={style}>
            {children}
        </div>
    );
}
