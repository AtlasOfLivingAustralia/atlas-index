import UserContext from "../helpers/UserContext.ts";
import {useContext, useEffect} from "react";
import {Breadcrumb, ListsUser} from "../api/sources/model.ts";
import DashboardPage from "../components/dashboard/dashboard"

function Dashboard({ setBreadcrumbs }: {setBreadcrumbs: (crumbs: Breadcrumb[]) => void; }) {

    const currentUser = useContext(UserContext) as ListsUser;

    useEffect(() => {
        setBreadcrumbs([
            { title: 'Home', href: import.meta.env.VITE_HOME_URL },
            { title: 'Default UI', href: '/' },
            { title: 'Dashboard', href: '/dashboard' },
        ]);
    }, []);

    return (
        <>
            <div className="container-fluid">
                <h2>Dashboard</h2>
                {!currentUser?.isAdmin &&
                    <p>User {currentUser?.user?.profile?.name} is not authorised to access these tools.</p>
                }
                {currentUser?.isAdmin &&
                    <>
                        <DashboardPage />
                    </>
                }
            </div>
        </>
    );
}

export default Dashboard;
