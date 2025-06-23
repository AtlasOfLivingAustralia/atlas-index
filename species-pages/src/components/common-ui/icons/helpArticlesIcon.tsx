/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export default function HelpArticlesIcon(props: { size?: string, className?: string, onClick?: () => void }) {
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
            <path d="M6.01172 12C3.85547 12 1.88672 10.875 0.808594 9C-0.269531 7.14844 -0.269531 4.875 0.808594 3C1.88672 1.14844 3.85547 0 6.01172 0C8.14453 0 10.1133 1.14844 11.1914 3C12.2695 4.875 12.2695 7.14844 11.1914 9C10.1133 10.875 8.14453 12 6.01172 12ZM5.07422 7.875C4.74609 7.875 4.51172 8.13281 4.51172 8.4375C4.51172 8.76562 4.74609 9 5.07422 9H6.94922C7.25391 9 7.51172 8.76562 7.51172 8.4375C7.51172 8.13281 7.25391 7.875 6.94922 7.875H6.76172V5.8125C6.76172 5.50781 6.50391 5.25 6.19922 5.25H5.07422C4.74609 5.25 4.51172 5.50781 4.51172 5.8125C4.51172 6.14062 4.74609 6.375 5.07422 6.375H5.63672V7.875H5.07422ZM6.01172 3C5.58984 3 5.26172 3.35156 5.26172 3.75C5.26172 4.17188 5.58984 4.5 6.01172 4.5C6.41016 4.5 6.76172 4.17188 6.76172 3.75C6.76172 3.35156 6.41016 3 6.01172 3Z" />
        </svg>
    );
}
