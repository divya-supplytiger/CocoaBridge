import { useNavigate } from "react-router";

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-base-100 text-center px-4">
      <h1 className="text-8xl font-bold text-primary">404</h1>
      <h2 className="mt-4 text-2xl font-semibold text-primary-content">Page Not Found</h2>
      <p className="mt-2 text-primary-content">The page you requested does not exist.</p>
      <button
        onClick={() => navigate("/dashboard")}
        className="mt-8 px-6 py-2.5 bg-base-300 text-primary-content rounded-lg font-medium hover:bg-primary transition-colors"
      >
        Back to Home
      </button>
    </div>
  );
};

export default NotFoundPage;
