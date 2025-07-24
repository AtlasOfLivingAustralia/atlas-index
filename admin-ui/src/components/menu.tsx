/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { NavLink } from 'react-router-dom';
import './menu.css';

function Menu() {
    return (
        <div className="d-flex flex-column gap-2 mb-3 side-menu">
            <NavLink to="/" className="menu-link">
                Home
            </NavLink>
            <NavLink to="/search" className="menu-link">
                Search Index
            </NavLink>
            <NavLink to="/dq" className="menu-link">
                Data Quality
            </NavLink>
            <NavLink to="/tasks" className="menu-link">
                Tasks
            </NavLink>
        </div>
    );
}
export default Menu;
