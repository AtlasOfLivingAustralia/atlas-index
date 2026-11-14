/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {NavLink} from 'react-router-dom';
import './menu.css';

/** Admin section side navigation, shown only to ROLE_ADMIN / ROLE_IMAGE_ADMIN users (see App.tsx). */
function Menu() {
    return (
        <div className="d-flex flex-column gap-2 mb-3 side-menu">
            <NavLink to="/admin" end className="menu-link">Dashboard</NavLink>
            <NavLink to="/admin/upload" className="menu-link">Upload</NavLink>
            <NavLink to="/admin/batches" className="menu-link">Batch status</NavLink>
            <NavLink to="/admin/search-criteria" className="menu-link">Search criteria</NavLink>
            <NavLink to="/admin/index-search" className="menu-link">Raw index search</NavLink>
            <NavLink to="/admin/tags" className="menu-link">Tags</NavLink>
            <NavLink to="/admin/storage-locations" className="menu-link">Storage locations</NavLink>
            <NavLink to="/admin/licences" className="menu-link">Licences</NavLink>
            <NavLink to="/admin/duplicates" className="menu-link">Duplicates</NavLink>
            <NavLink to="/admin/analytics" className="menu-link">Analytics</NavLink>
            <NavLink to="/admin/settings" className="menu-link">Settings</NavLink>
            <NavLink to="/admin/tools" className="menu-link">Tools</NavLink>
            <NavLink to="/admin/swagger" className="menu-link">Swagger</NavLink>
        </div>
    );
}

export default Menu;
