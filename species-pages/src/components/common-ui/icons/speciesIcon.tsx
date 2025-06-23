/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export default function SpeciesIcon(props: { size?: string, className?: string, onClick?: () => void }) {
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
            <path d="M3 1H3.75C4.14844 1 4.5 1.35156 4.5 1.75V2.5H2.25V1.75C2.25 1.35156 2.57812 1 3 1ZM4.5 3.25V10.75C4.5 11.1719 4.14844 11.5 3.75 11.5H0.75C0.328125 11.5 0 11.1719 0 10.75V9.36719C0 8.57031 0.210938 7.77344 0.632812 7.07031C0.9375 6.53125 1.14844 5.94531 1.24219 5.3125L1.40625 3.90625C1.45312 3.53125 1.78125 3.25 2.15625 3.25H4.5ZM9.82031 3.25C10.1953 3.25 10.5234 3.53125 10.5703 3.90625L10.7578 5.3125C10.8281 5.94531 11.0391 6.53125 11.3438 7.07031C11.7656 7.77344 12 8.57031 12 9.36719V10.75C12 11.1719 11.6484 11.5 11.25 11.5H8.25C7.82812 11.5 7.5 11.1719 7.5 10.75V3.25H9.82031ZM7.5 1.75C7.5 1.35156 7.82812 1 8.25 1H9C9.39844 1 9.75 1.35156 9.75 1.75V2.5H7.5V1.75ZM6.75 3.25V7H5.25V3.25H6.75Z" />
        </svg>
    );
}
