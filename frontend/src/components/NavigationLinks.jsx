import {Home, Mail, BrainCog, Calendar, BarChart, Contact, Lock, Award, Handshake, Star, MessageSquare} from "lucide-react";

export const NAVIGATION_LINKS = [
    { name: "Dashboard", path: "/dashboard", icon: <Home className="size-5"/> },
    { name: "Inbox", path: "/inbox", icon: <Mail className="size-5"/> },
    { name: "Opportunities", path: "/opportunities", icon: <Handshake className="size-5"/> },
    { name: "Awards", path: "/awards", icon: <Award className="size-5"/> },
    { name: "Market Intelligence", path: "/market-intelligence" ,icon: <BrainCog className="size-5"/>},

    { name: "Contacts", path: "/contacts", icon: <Contact className="size-5"/> },
        { name: "Analytics", path: "/analytics", icon: <BarChart className="size-5"/> },
    { name: "Chat", path: "/chat", icon: <MessageSquare className="size-5"/> },
    { name: "Calendar", path: "/calendar", icon: <Calendar className="size-5"/> },
    { name: "Admin", path: "/admin", icon: <Lock className="size-5"/> },
        { name: "Favorites", path: "/favorites", icon: <Star className="size-5"/> },

];