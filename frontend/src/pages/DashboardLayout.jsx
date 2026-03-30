import { Outlet } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useClerk } from "@clerk/clerk-react";
import Navbar from "../components/Navbar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import Footer from "../components/Footer.jsx";
import PageLoader from "../components/PageLoader.jsx";
import { CurrentUserContext } from "../lib/CurrentUserContext.jsx";
import { adminApi } from "../lib/api.js";

const DashboardLayout = () => {
    const { signOut } = useClerk();
    const { data: currentUser, isLoading, isError, error } = useQuery({
        queryKey: ["currentUser"],
        queryFn: adminApi.getCurrentUser,
        staleTime: 5 * 60 * 1000,
        retry: false,
    });

    if (isLoading) return <PageLoader />;

    if (isError && error?.response?.status === 403) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-accent/20">
                <div className="card bg-base-100 shadow-md max-w-sm w-full mx-4">
                    <div className="card-body items-center text-center gap-4">
                        <h2 className="card-title text-error">Account Deactivated</h2>
                        <p className="text-sm text-base-content/70">
                            Your account has been deactivated. Please contact your administrator for assistance.
                        </p>
                        <button className="btn btn-sm btn-ghost" onClick={() => signOut()}>
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        );
    }

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
