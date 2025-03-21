/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

const FontAwesomeIconLite = (props: any) => {
    return <svg aria-hidden="true" focusable="false" data-prefix={props.icon.prefix} data-icon={props.icon.name}
                className={"svg-inline--fa " + props.className} role="img"
                xmlns="http://www.w3.org/2000/svg" viewBox={"0 0 " + props.icon.icon[0] + " " + props.icon.icon[1]}>
        <path fill="currentColor"
              d={props.icon.icon[4]}></path>
    </svg>
}

export default FontAwesomeIconLite;


