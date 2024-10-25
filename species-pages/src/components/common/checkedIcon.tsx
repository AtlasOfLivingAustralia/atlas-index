export default function CheckIcon(props: { size?: string, className?: string, onClick?: () => void }) {
    let size = props.size ? props.size : 16;
    return (
        <svg width={size}
             height={size}
             viewBox="0 0 16 16"
             fill="none"
             xmlns="http://www.w3.org/2000/svg"
             className={props.className}
             onClick={props.onClick}
             style={{ flexShrink: 0, marginTop: "1px" }}
        >
            <g>
                <path id="&#239;&#133;&#138;"
                      d="M2.25 0H13.5C14.7305 0 15.75 1.01953 15.75 2.25V13.5C15.75 14.7656 14.7305 15.75 13.5 15.75H2.25C0.984375 15.75 0 14.7656 0 13.5V2.25C0 1.01953 0.984375 0 2.25 0ZM11.8477 6.22266H11.8125C12.1641 5.90625 12.1641 5.37891 11.8125 5.02734C11.4961 4.71094 10.9688 4.71094 10.6523 5.02734L6.75 8.96484L5.09766 7.3125C4.74609 6.96094 4.21875 6.96094 3.90234 7.3125C3.55078 7.62891 3.55078 8.15625 3.90234 8.47266L6.15234 10.7227C6.46875 11.0742 6.99609 11.0742 7.34766 10.7227L11.8477 6.22266Z"
                      fill="#212121"/>
            </g>
        </svg>
    )
        ;
}
