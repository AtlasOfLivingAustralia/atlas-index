/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export default function ListIcon(props: { size?: string, className?: string, onClick?: () => void }) {
    let size = props.size ? props.size : 14;
    return (
        <svg width={size}
             height={size}
             viewBox="0 0 14 14"
             fill="currentColor"
             xmlns="http://www.w3.org/2000/svg"
             className={props.className}
             onClick={props.onClick}
             style={{flexShrink: 0, marginTop: "3px", verticalAlign: "top"}}
        >
            <path d="M5.5 2.125V4.1875H11.875V2.5C11.875 2.3125 11.6875 2.125 11.5 2.125H5.5ZM4.375 2.125H2.5C2.28906 2.125 2.125 2.3125 2.125 2.5V4.1875H4.375V2.125ZM2.125 5.3125V7.1875H4.375V5.3125H2.125ZM2.125 8.3125V10C2.125 10.2109 2.28906 10.375 2.5 10.375H4.375V8.3125H2.125ZM5.5 10.375H11.5C11.6875 10.375 11.875 10.2109 11.875 10V8.3125H5.5V10.375ZM11.875 7.1875V5.3125H5.5V7.1875H11.875ZM1 2.5C1 1.67969 1.65625 1 2.5 1H11.5C12.3203 1 13 1.67969 13 2.5V10C13 10.8438 12.3203 11.5 11.5 11.5H2.5C1.65625 11.5 1 10.8438 1 10V2.5Z" fill="#637073"/>
        </svg>
    );
}
