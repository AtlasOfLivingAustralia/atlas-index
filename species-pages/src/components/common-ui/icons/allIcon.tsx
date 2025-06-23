/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export default function AllIcon(props: { size?: string, className?: string, onClick?: () => void }) {
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
            <path
                    d="M9.75476 4.86787C9.75476 5.94442 9.40303 6.95076 8.8168 7.74646L11.7714 10.7187C12.0762 10.9995 12.0762 11.491 11.7714 11.7718C11.49 12.0761 10.9976 12.0761 10.7162 11.7718L7.73815 8.79961C6.94089 9.40809 5.93258 9.73574 4.87738 9.73574C2.18075 9.73574 0 7.55924 0 4.86787C0 2.1999 2.18075 0 4.87738 0C7.55056 0 9.75476 2.1999 9.75476 4.86787ZM4.87738 8.23793C6.07328 8.23793 7.17538 7.60605 7.78505 6.5529C8.39472 5.52316 8.39472 4.23598 7.78505 3.18284C7.17538 2.1531 6.07328 1.49781 4.87738 1.49781C3.65804 1.49781 2.55594 2.1531 1.94626 3.18284C1.33659 4.23598 1.33659 5.52316 1.94626 6.5529C2.55594 7.60605 3.65804 8.23793 4.87738 8.23793Z"/>
        </svg>
    );
}
