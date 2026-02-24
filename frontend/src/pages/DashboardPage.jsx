import { useCurrentUser } from "../lib/CurrentUserContext.jsx";
import { Lock } from "lucide-react";
const DashboardPage = () => {
  const currentUser = useCurrentUser();

  if (currentUser?.role === "USER") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="card bg-base-200 shadow-sm max-w-md w-full">
          <div className="card-body items-center gap-3">
            <div className="text-4xl"><Lock/> </div>
            <h2 className="card-title text-lg">Access Restricted</h2>
            <p className="text-base-content/70 text-sm">
              You don&apos;t have the credentials to view this data. Please
              contact the system administrator to receive access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      I have made a code change but I need feedback before pushing.
    </div>
  );
};

export default DashboardPage;
