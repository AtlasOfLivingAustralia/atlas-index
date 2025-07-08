/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export default function SpeciesListsIcon(props: { size?: string, className?: string, onClick?: () => void }) {
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
            <path d="M5.4375 0.123047C5.78906 -0.0410156 6.1875 -0.0410156 6.53906 0.123047L11.6719 2.49023C11.8594 2.58398 12 2.77148 12 2.98242C12 3.2168 11.8594 3.4043 11.6719 3.49805L6.53906 5.86523C6.1875 6.0293 5.78906 6.0293 5.4375 5.86523L0.304688 3.49805C0.117188 3.4043 0 3.2168 0 2.98242C0 2.77148 0.117188 2.58398 0.304688 2.49023L5.4375 0.123047ZM10.4062 4.9043L11.6719 5.49023C11.8594 5.58398 12 5.77148 12 5.98242C12 6.2168 11.8594 6.4043 11.6719 6.49805L6.53906 8.86523C6.1875 9.0293 5.78906 9.0293 5.4375 8.86523L0.304688 6.49805C0.117188 6.4043 0 6.2168 0 5.98242C0 5.77148 0.117188 5.58398 0.304688 5.49023L1.57031 4.9043L5.13281 6.54492C5.67188 6.80273 6.30469 6.80273 6.84375 6.54492L10.4062 4.9043ZM6.84375 9.54492L10.4062 7.9043L11.6719 8.49023C11.8594 8.58398 12 8.77148 12 8.98242C12 9.2168 11.8594 9.4043 11.6719 9.49805L6.53906 11.8652C6.1875 12.0293 5.78906 12.0293 5.4375 11.8652L0.304688 9.49805C0.117188 9.4043 0 9.2168 0 8.98242C0 8.77148 0.117188 8.58398 0.304688 8.49023L1.57031 7.9043L5.13281 9.54492C5.67188 9.80273 6.30469 9.80273 6.84375 9.54492Z" />

        </svg>
    );
}
