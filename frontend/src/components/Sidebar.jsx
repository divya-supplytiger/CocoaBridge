import {useUser} from "@clerk/clerk-react";
import {Link, useLocation} from "react-router";
import {Search} from "lucide-react";
import {NAVIGATION_LINKS} from "./NavigationLinks.jsx";
import {useCurrentUser} from "../lib/CurrentUserContext.jsx";

const Sidebar = () => {
    const location = useLocation();
    const {user} = useUser();
    const currentUser = useCurrentUser();

    const mainLinks = NAVIGATION_LINKS.filter(item => item.path !== "/admin");
    const adminLinks = NAVIGATION_LINKS.filter(item => item.path === "/admin");

    return (
        <div className="drawer-side is-drawer-close:overflow-visible">
            {/* overlay to close sidebar on small screens */}
            <label htmlFor="my-drawer"
                aria-label="close sidebar"
                className="drawer-overlay"
            ></label>

            <div className="flex min-h-full flex-col bg-secondary/40 is-drawer-close:w-14 is-drawer-open:w-64 transition-all duration-200">

                {/* sidebar header */}
                <div className="p-4 w-full bg-primary">
                    <div className="flex items-center gap-3 is-drawer-close:justify-center">
                        <img
                            src="st-icon-logo.jpg"
                            alt="SupplyTiger Logo"
                            className="size-10 rounded-xl flex items-center justify-center shrink-0"
                        />
                        <span className="text-3xl harletitle is-drawer-close:hidden text-secondary-content">SupplyTiger</span>
                    </div>
                </div>

                {/* main navigation links */}
                <ul className="menu w-full grow flex flex-col gap-2">
                    {mainLinks.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <li key={item.path}>
                                <Link
                                    to={item.path}
                                    data-tip={item.name}
                                    className={`is-drawer-close:tooltip is-drawer-close:tooltip-right is-drawer-close:justify-center ${isActive ? "bg-primary/50 text-primary-content" : ""}`}
                                >
                                    {item.icon}
                                    <span className="is-drawer-close:hidden">{item.name}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>

                {/* admin link — only visible to ADMIN role */}
                {currentUser?.role === "ADMIN" && (
                    <div className="w-full px-2 pb-2">
                        <div className="divider my-1 is-drawer-close:hidden"></div>
                        <ul className="menu w-full">
                            {adminLinks.map((item) => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <li key={item.path}>
                                        <Link
                                            to={item.path}
                                            data-tip={item.name}
                                            className={`is-drawer-close:tooltip is-drawer-close:tooltip-right is-drawer-close:justify-center ${isActive ? "bg-success text-success-content" : ""}`}
                                        >
                                            {item.icon}
                                            <span className="is-drawer-close:hidden">{item.name}</span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {/* user info */}
                <div className="p-4 w-full border-t border-base-300 bg-primary text-primary-content">
                    <div className="flex items-center gap-3 is-drawer-close:justify-center">
                        <div className="avatar shrink-0">
                            <img
                                src={user?.imageUrl}
                                alt={user?.fullName}
                                className="w-10 h-10 rounded-full"
                            />
                        </div>
                        <div className="flex-1 min-w-0 is-drawer-close:hidden">
                            <p className="text-sm font-semibold truncate">
                                {user?.firstName} {user?.lastName}
                            </p>
                            <div className="text-xs opacity-60 truncate">
                                {user?.emailAddresses?.[0]?.emailAddress}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Sidebar;
