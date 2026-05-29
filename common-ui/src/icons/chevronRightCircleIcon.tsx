/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export default function ChevronRightIcon(props: { size?: string | number, className?: string, onClick?: () => void }) {
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
            <path d="M20.5742 15.6758C20.8086 15.9102 20.8086 16.3398 20.5742 16.5742L13.0742 24.0742C12.8398 24.3086 12.4102 24.3086 12.1758 24.0742C11.9414 23.8398 11.9414 23.4102 12.1758 23.1758L19.2461 16.1055L12.1758 9.07422C11.9414 8.83984 11.9414 8.41016 12.1758 8.17578C12.4102 7.94141 12.8398 7.94141 13.0742 8.17578L20.5742 15.6758Z" fill="#212121"/>
        </svg>
    );
}
