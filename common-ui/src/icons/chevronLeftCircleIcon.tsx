/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export default function ChevronLeftIcon(props: { size?: string | number, className?: string, onClick?: () => void }) {
    let size = props.size ?? 12;
    return (
        <svg width={size}
             height={size}
             viewBox="0 0 32 32"
             fill="currentColor"
             xmlns="http://www.w3.org/2000/svg"
             className={props.className}
             onClick={props.onClick}
             style={{flexShrink: 0, marginTop: "3px", verticalAlign: "top"}}
        >
            <circle cx="16" cy="16" r="15.5" fill="white" stroke="#212121"/>
            <path d="M10.1758 16.5742C9.94141 16.3398 9.94141 15.9102 10.1758 15.6758L17.6758 8.17578C17.9102 7.94141 18.3398 7.94141 18.5742 8.17578C18.8086 8.41016 18.8086 8.83984 18.5742 9.07422L11.5039 16.1445L18.5742 23.1758C18.8086 23.4102 18.8086 23.8398 18.5742 24.0742C18.3398 24.3086 17.9102 24.3086 17.6758 24.0742L10.1758 16.5742Z" fill="#212121"/>
        </svg>
    );
}
