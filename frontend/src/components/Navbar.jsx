import { useState } from "react";
import { UserButton } from "@clerk/clerk-react";
import { useLocation, useNavigate } from "react-router";
import { NAVIGATION_LINKS } from "./NavigationLinks.jsx";
import { PanelLeftIcon, Search } from "lucide-react";

const Navbar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);

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

    return (
        <div className="navbar w-full bg-secondary text-secondary-content relative">
            {/* button to open sidebar on small screens */}
            <label htmlFor="my-drawer" className="btn btn-square btn-ghost" aria-label="open sidebar">
                <PanelLeftIcon className="size-5" />
            </label>

            {/* dynamic title */}
            <div className="flex-1 px-4">
                <h1 className="text-2xl font-bold">
                    {NAVIGATION_LINKS.find((item) => item.path === location.pathname)?.name || "Dashboard"}
                </h1>
            </div>

            {/* page search */}
            <div className="relative mr-3">
                <div className="flex items-center gap-2 input input-sm bg-secondary-content/10 border-secondary-content/30 text-secondary-content w-48 focus-within:w-64 transition-all duration-200">
                    <Search className="size-4 opacity-60 shrink-0" />
                    <input
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
                    <ul className="absolute right-0 mt-1 w-48 bg-base-100 shadow-lg rounded-box border border-base-300 z-50 py-1">
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
                                        className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-base-200 text-left"
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

            {/* user profile */}
            <div className="mr-5">
                <UserButton className="size-5" />
            </div>
        </div>
    );
};

export default Navbar;