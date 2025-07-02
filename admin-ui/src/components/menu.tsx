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
        </div>
    );
}
export default Menu;
