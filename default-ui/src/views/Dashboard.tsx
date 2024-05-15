import {useEffect} from "react";
import {Breadcrumb} from "../api/sources/model.ts";
import DashboardPage from "../components/dashboard/dashboard"

function Dashboard({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void; }) {

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Default UI', href: '/'},
            {title: 'Dashboard', href: '/dashboard'},
        ]);
    }, []);

    return (
        <>
            <div className="container-fluid">
                <DashboardPage/>
            </div>
        </>
    );
}

export default Dashboard;
