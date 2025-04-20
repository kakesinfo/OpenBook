import "./FormGroup.scss"

export default function FormGroup({ children, className, style }: { children: React.ReactNode, className?: string, style?: React.CSSProperties }) {
    return (
        <div className={`form-group ${className}`} style={style}>
            {children}
        </div>
    )
}