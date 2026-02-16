import {SignIn} from "@clerk/clerk-react";
const LoginPage = () => {
    return (
        <div className="h-screen hero">
            <SignIn />
        </div>
    );
};

export default LoginPage;