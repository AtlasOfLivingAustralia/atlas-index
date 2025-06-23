/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export default function DatasetsIcon(props: { size?: string, className?: string, onClick?: () => void }) {
    let size = props.size ? props.size : 12;
    return (
        <svg width={size}
             height={size}
             viewBox="0 0 12 12"
             fill="currentColor"
             xmlns="http://www.w3.org/2000/svg"
             className={props.className}
             onClick={props.onClick}
             style={{flexShrink: 0, marginTop: "3px", verticalAlign: "top"}}
        >
            <path d="M1.5 6.25H5.25V4H1.5V6.25ZM1.5 7.75V10H5.25V7.75H1.5ZM6.75 10H10.5V7.75H6.75V10ZM10.5 6.25V4H6.75V6.25H10.5ZM1.5 1H10.5C11.3203 1 12 1.67969 12 2.5V10C12 10.8438 11.3203 11.5 10.5 11.5H1.5C0.65625 11.5 0 10.8438 0 10V2.5C0 1.67969 0.65625 1 1.5 1Z" />
        </svg>
    );
}
