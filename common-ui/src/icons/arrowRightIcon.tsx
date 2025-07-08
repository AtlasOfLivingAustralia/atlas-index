/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export default function ArrowRightIcon(props: { size?: string, className?: string, onClick?: () => void }) {
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
            <path d="M11.3125 6.9132L7.1875 10.8507C6.95312 11.0616 6.60156 11.0616 6.39062 10.8273C6.17969 10.5929 6.17969 10.2413 6.41406 10.0304L9.53125 7.05383H1.5625C1.23438 7.05383 1 6.81945 1 6.49133C1 6.18664 1.23438 5.92883 1.5625 5.92883H9.53125L6.41406 2.9757C6.17969 2.76476 6.17969 2.38976 6.39062 2.17883C6.60156 1.94445 6.97656 1.94445 7.1875 2.15539L11.3125 6.09289C11.4297 6.21008 11.5 6.3507 11.5 6.49133C11.5 6.65539 11.4297 6.79601 11.3125 6.9132Z" />
        </svg>
    );
}
