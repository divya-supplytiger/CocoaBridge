import "./index.css";
import {Navigate, Route, Routes} from "react-router";
import {useAuth} from "@clerk/clerk-react";


import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import PageLoader from "./components/PageLoader";

function App() {
  const { isSignedIn, isLoaded } = useAuth();

  if(!isLoaded) return <PageLoader />;

  return (
    <Routes>
      <Route path="/login"
      element={isSignedIn? <Navigate to={"/dashboard"} /> : <LoginPage />} />
      <Route path="/" element={isSignedIn ? <Navigate to={"/dashboard"} /> : <Navigate to={"/login"} />} />
      <Route path = "dashboard" element = {<DashboardPage />} />
    </Routes>
  );
}

export default App;
