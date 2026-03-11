import { SignIn } from "@clerk/clerk-react";
import { Layers } from "lucide-react";
import Footer from "../components/Footer";

const LoginPage = () => {
    return (
        <div className="flex flex-col min-h-screen">
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
            {/* Branding panel — hidden on mobile */}
            <div className="hidden lg:flex flex-col items-center justify-center gap-4 bg-accent/20 px-12">
                <img src="/cocoaBridgeLogoBeanOnly.svg" className="size-85 -mb-10 opacity-90" />
                <img src="/cocoaBridgeName.svg" className="w-[475px] opacity-90" />
                <p className="text-2xl opacity-75 text-center text-secondary">Where Confectionery Meets Opportunity</p>
            </div>

            {/* Clerk sign-in panel */}
            <div className="flex items-center justify-center min-h-screen  bg-secondary text-secondary-content">
                <SignIn />
            </div>
        </div>
        <Footer />
        </div>
    );
};

export default LoginPage;
