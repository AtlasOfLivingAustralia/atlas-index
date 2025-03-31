/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import styles from "./fontAwesomeIconLite.module.css";

const FontAwesomeIconLite = (props: any) => {
    return <svg aria-hidden="true" focusable="false"
                className={styles.svgInline + (props.className ? " " + props.className : "")}
                xmlns="http://www.w3.org/2000/svg" viewBox={"0 0 " + props.icon.icon[0] + " " + props.icon.icon[1]}>
        <path fill="currentColor"
              d={props.icon.icon[4]}></path>
    </svg>
}

export default FontAwesomeIconLite;


