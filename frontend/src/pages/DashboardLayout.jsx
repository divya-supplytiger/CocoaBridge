import { Outlet } from "react-router";
import { useQuery } from "@tanstack/react-query";
import Navbar from "../components/Navbar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import Footer from "../components/Footer.jsx";
import PageLoader from "../components/PageLoader.jsx";
import { CurrentUserContext } from "../lib/CurrentUserContext.jsx";
import { adminApi } from "../lib/api.js";

const DashboardLayout = () => {
    const { data: currentUser, isLoading } = useQuery({
        queryKey: ["currentUser"],
        queryFn: adminApi.getCurrentUser,
        staleTime: 5 * 60 * 1000, // cache for 5 minutes
        retry: 1,
    });

    if (isLoading) return <PageLoader />;

    return (
        <CurrentUserContext.Provider value={currentUser ?? null}>
            <div className="drawer lg:drawer-open">
                <input
                    id="my-drawer"
                    type="checkbox"
                    className="drawer-toggle"
                    defaultChecked
                />
                <div className="drawer-content flex flex-col min-h-screen bg-accent/20 text-accent-content">
                    <Navbar />
                    <div className="p-4 flex-1">
                        <Outlet />
                    </div>
                    <Footer />
                </div>
                <Sidebar />
            </div>
        </CurrentUserContext.Provider>
    );
};

export default DashboardLayout;
