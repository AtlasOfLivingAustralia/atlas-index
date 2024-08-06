import {useEffect} from "react";
import {Breadcrumb} from "../api/sources/model.ts";
import DashboardPage from "../components/dashboard/dashboard"
import { Container, Space } from "@mantine/core";

function Dashboard({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void; }) {

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Default UI', href: '/'},
            {title: 'Dashboard', href: '/dashboard'},
        ]);
    }, []);

    return (
        <Container size="lg">
            <Space h="md"/>
            <DashboardPage/>
        </Container>
    );
}

export default Dashboard;
