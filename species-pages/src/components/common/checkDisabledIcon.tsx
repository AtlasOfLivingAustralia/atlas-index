export default function CheckIcon(props: { size?: string, className?: string}) {
    let size = props.size ? props.size : "16";
    return (
        <svg width={size}
             height={size}
             viewBox="0 0 16 16"
             fill="none"
             xmlns="http://www.w3.org/2000/svg"
             className={props.className}
             style={{ flexShrink: 0, marginTop: "1px" }}
        >
            <g>
                <rect x="1" y="1" width="14" height="14" fill="#D9D9D9"/>
                <path id="&#239;&#131;&#136;"
                      d="M13.5 1.125H2.25C1.61719 1.125 1.125 1.65234 1.125 2.25V13.5C1.125 14.1328 1.61719 14.625 2.25 14.625H13.5C14.0977 14.625 14.625 14.1328 14.625 13.5V2.25C14.625 1.65234 14.0977 1.125 13.5 1.125ZM2.25 0H13.5C14.7305 0 15.75 1.01953 15.75 2.25V13.5C15.75 14.7656 14.7305 15.75 13.5 15.75H2.25C0.984375 15.75 0 14.7656 0 13.5V2.25C0 1.01953 0.984375 0 2.25 0Z"
                      fill="#212121"/>
            </g>
        </svg>
    );
}
