import {useUser} from "@clerk/clerk-react";
import {useState, useRef} from "react";
import {Link, useLocation, useNavigate} from "react-router";
import {Search} from "lucide-react";
import {NAVIGATION_LINKS} from "./NavigationLinks.jsx";
import {useCurrentUser} from "../lib/CurrentUserContext.jsx";

const Sidebar = () => {
    const location = useLocation();
    const {user} = useUser();
    const currentUser = useCurrentUser();

    const mainLinks = NAVIGATION_LINKS.filter(item => item.path !== "/admin");
    const adminLinks = NAVIGATION_LINKS.filter(item => item.path === "/admin");

    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const searchInputRef = useRef(null);

    const results = query.trim()
        ? NAVIGATION_LINKS.filter((item) =>
            item.name.toLowerCase().includes(query.toLowerCase())
          )
        : [];

    const handleSelect = (path) => {
        navigate(path);
        setQuery("");
        setOpen(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && results.length > 0) handleSelect(results[0].path);
        if (e.key === "Escape") { setQuery(""); setOpen(false); }
    };

    const openDrawer = () => {
        document.documentElement.classList.add("is-drawer-open");
        const drawerToggle = document.getElementById("my-drawer");
        if (drawerToggle && "checked" in drawerToggle) {
            drawerToggle.checked = true;
        }
    };

    const onSearchIconClick = () => {
        openDrawer();
        setTimeout(() => {
            searchInputRef.current?.focus();
            setOpen(true);
        }, 200);
    };

    return (
        <div className="drawer-side is-drawer-close:overflow-visible">
            {/* overlay to close sidebar on small screens */}
            <label htmlFor="my-drawer"
                aria-label="close sidebar"
                className="drawer-overlay"
            ></label>

            <div className="flex min-h-full flex-col bg-base-100 text-accent-content is-drawer-close:w-14 is-drawer-open:w-64 transition-all duration-200">

                {/* sidebar header */}
                <div className="p-4 is-drawer-close:px-2 w-full bg-primary">
                    <div className="flex items-center gap-3 is-drawer-close:justify-center">
                        <img
                            src="st-icon-logo.jpg"
                            alt="SupplyTiger Logo"
                            className="size-10 rounded-xl flex items-center justify-center shrink-0"
                        />
                        <span className="text-3xl harletitle is-drawer-close:hidden text-secondary-content">SupplyTiger</span>
                    </div>
                </div>

                {/* page search — icon only when drawer closed, full bar when open */}
                <div className="is-drawer-open:hidden flex justify-center mt-2 tooltip tooltip-right" data-tip="Search">
                    <button onClick={onSearchIconClick} className="p-2 rounded-lg hover:bg-secondary-content/10 text-secondary-content">
                        <Search className="size-4" />
                    </button>
                </div>

                <div className="is-drawer-close:hidden relative mx-2 mt-2">
                    <div className="flex items-center gap-2 input input-sm bg-accent-content/10 border-secondary-content/40 text-accent-content w-full">
                        <Search className="size-4 opacity-60 shrink-0" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            className="bg-transparent outline-none placeholder:text-secondary-content/50 text-secondary-content w-full text-sm"
                            placeholder="Go to page…"
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                            onFocus={() => setOpen(true)}
                            onBlur={() => setTimeout(() => setOpen(false), 150)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>

                    {open && query.trim() && (
                        <ul className="absolute right-0 mt-1 w-48 bg-base-100 shadow-lg rounded-box border border-base-300 z-50 py-1 w-full">
                            {results.length === 0 ? (
                                <li>
                                    <span className="flex items-center px-3 py-2 text-sm text-base-content/50">
                                        No results found
                                    </span>
                                </li>
                            ) : (
                                results.map((item) => (
                                    <li key={item.path}>
                                        <button
                                            className="flex items-center gap-2 w-full px-3 py-2 bg-base-100 text-sm hover:bg-accent-content/10 text-left"
                                            onMouseDown={() => handleSelect(item.path)}
                                        >
                                            {item.icon}
                                            {item.name}
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>
                    )}
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
                                    className={`is-drawer-close:tooltip is-drawer-close:tooltip-right is-drawer-close:justify-center ${isActive ? "bg-secondary/50 text-secondary-content" : ""}`}
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
                    <div className="w-full grow flex flex-col">
                        <div className="divider my-1 mx-1"></div>
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
