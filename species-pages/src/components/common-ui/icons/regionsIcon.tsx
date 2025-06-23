/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export default function RegionsIcon(props: { size?: string, className?: string, onClick?: () => void }) {
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
            <path d="M10 4.5C10 6.5625 7.25781 10.1953 6.03906 11.7188C5.75781 12.0703 5.21875 12.0703 4.9375 11.7188C3.74219 10.1953 1 6.5625 1 4.5C1 2.01562 3.01562 0 5.5 0C7.98438 0 10 2.01562 10 4.5Z" />
        </svg>
    );
}
