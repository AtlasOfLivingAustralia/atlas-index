/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Standard 404 Not Found component.
 *
 * @constructor
 */
const NotFound = () => {
    return <div className={"d-flex flex-column align-items-center justify-content-center"}>
        <h1 style={{marginTop: "60px", marginBottom: "60px"}}>Page Not Found</h1>
        <p>The page you are looking for does not exist.</p>
        <p>Please check the URL or return to the homepage.</p>
    </div>
}

export default NotFound;
