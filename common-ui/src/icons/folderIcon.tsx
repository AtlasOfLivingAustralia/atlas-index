/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export default function FolderIcon(props: { size?: string, className?: string, onClick?: () => void }) {
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
            <path d="M11.5556 9.85714H3.61111C2.79861 9.85714 2.16667 9.23214 2.16667 8.42857V3.42857C2.16667 2.64732 2.79861 2 3.61111 2H6.25174C6.63542 2 6.99653 2.15625 7.26736 2.42411L7.87674 3.02679C8.14757 3.29464 8.50868 3.42857 8.89236 3.42857H11.5556C12.3455 3.42857 13 4.07589 13 4.85714V8.42857C13 9.23214 12.3455 9.85714 11.5556 9.85714ZM1.08333 3.96429V8.96429C1.08333 10.058 1.96354 10.9286 3.06944 10.9286H10.2917C10.5851 10.9286 10.8333 11.1741 10.8333 11.4643C10.8333 11.7768 10.5851 12 10.2917 12H3.06944C1.35417 12 0 10.6607 0 8.96429V3.96429C0 3.67411 0.225694 3.42857 0.541667 3.42857C0.835069 3.42857 1.08333 3.67411 1.08333 3.96429Z" />
        </svg>
    );
}
