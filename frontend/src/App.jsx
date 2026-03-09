import "./index.css";
import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "@clerk/clerk-react";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import DashboardLayout from "./pages/DashboardLayout";
import InboxPage from "./pages/InboxPage";
import MarketIntelligencePage from "./pages/MarketIntelligencePage";
import AnalyticsPage from "./pages/AnalyticsPage";
import CalendarPage from "./pages/CalendarPage";
import ContactsPage from "./pages/ContactsPage";
import ContactDetail from "./pages/ContactDetail";
import RecipientDetail from "./pages/RecipientDetail";
import BuyingOrgDetail from "./pages/BuyingOrgDetail";
import AdminPage from "./pages/AdminPage";
import PageLoader from "./components/PageLoader";
import Opportunities from "./pages/OpportunitiesPage";
import Awards from "./pages/AwardsPage";
import InboxItemDetail from "./pages/InboxItemDetail";
import OpportunityDetail from "./pages/OpportunityDetail";
import AwardDetail from "./pages/AwardDetail";
import FavoritesPage from "./pages/FavoritesPage";
import NotFoundPage from "./pages/NotFoundPage";
import { useCurrentUser } from "./lib/CurrentUserContext.jsx";

// Requires READ_ONLY or ADMIN role — USER role is redirected to dashboard
const DataOnlyRoute = ({ children }) => {
  const currentUser = useCurrentUser();
  if (!currentUser) return <PageLoader />;
  if (currentUser.role === "USER") return <Navigate to="/dashboard" replace />;
  return children;
};

// Requires ADMIN role — all other roles are redirected to dashboard
const AdminRoute = ({ children }) => {
  const currentUser = useCurrentUser();
  if (!currentUser) return <PageLoader />;
  if (currentUser.role !== "ADMIN") return <Navigate to="/dashboard" replace />;
  return children;
};

function App() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return <PageLoader />;

  return (
    <Routes>
      <Route path="/login" element={isSignedIn ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/" element={isSignedIn ? <DashboardLayout /> : <Navigate to="/login" />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="inbox" element={<DataOnlyRoute><InboxPage /></DataOnlyRoute>} />
        <Route path="inbox/:id" element={<DataOnlyRoute><InboxItemDetail /></DataOnlyRoute>} />
        <Route path="opportunities" element={<DataOnlyRoute><Opportunities /></DataOnlyRoute>} />
        <Route path="opportunities/:id" element={<DataOnlyRoute><OpportunityDetail /></DataOnlyRoute>} />
        <Route path="awards" element={<DataOnlyRoute><Awards /></DataOnlyRoute>} />
        <Route path="awards/:id" element={<DataOnlyRoute><AwardDetail /></DataOnlyRoute>} />
        <Route path="market-intelligence" element={<DataOnlyRoute><MarketIntelligencePage /></DataOnlyRoute>} />
        <Route path="analytics" element={<DataOnlyRoute><AnalyticsPage /></DataOnlyRoute>} />
        <Route path="calendar" element={<DataOnlyRoute><CalendarPage /></DataOnlyRoute>} />
        <Route path="contacts" element={<DataOnlyRoute><ContactsPage /></DataOnlyRoute>} />
        <Route path="contacts/:id" element={<DataOnlyRoute><ContactDetail /></DataOnlyRoute>} />
        <Route path="recipients/:id" element={<DataOnlyRoute><RecipientDetail /></DataOnlyRoute>} />
        <Route path="buying-orgs/:id" element={<DataOnlyRoute><BuyingOrgDetail /></DataOnlyRoute>} />
        <Route path="admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        <Route path="favorites" element={<DataOnlyRoute><FavoritesPage /></DataOnlyRoute>} />

      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
