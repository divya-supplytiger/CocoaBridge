import {UserButton} from "@clerk/clerk-react";
import {useLocation } from "react-router";
import {NAVIGATION_LINKS} from "./NavigationLinks.jsx";
import {PanelLeftIcon} from "lucide-react";

const Navbar = () => {
    // Get the current location
    const location = useLocation();
    return (
<div className="navbar w-full bg-base-300">
    {/* button to open sidebar on small screens */}
    <label htmlFor="my-drawer" className="btn btn-square btn-ghost" aria-label="open sidebar">
        <PanelLeftIcon className="size-5"/>
    </label>
    {/* dynamic title based on the current path */}
    <div className="flex-1 px-4">
        <h1 className="text-2xl font-bold">{NAVIGATION_LINKS.find((item => item.path === location.pathname))?.name || "Dashboard"}</h1>
        </div>
    {/* user profile */}
    <div className="mr-5">
        <UserButton className="size-5"/>
    </div>
</div>
);
}

export default Navbar;