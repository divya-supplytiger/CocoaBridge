import "./index.css";
import {Navigate, Route, Routes} from "react-router";
import {useAuth} from "@clerk/clerk-react";


import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import DashboardLayout from "./pages/DashboardLayout";
import InboxPage from "./pages/InboxPage";
import MarketIntelligencePage from "./pages/MarketIntelligencePage";
import AnalyticsPage from "./pages/AnalyticsPage";
import CalendarPage from "./pages/CalendarPage";
import ContactsPage from "./pages/ContactsPage";
import AdminPage from "./pages/AdminPage";
import PageLoader from "./components/PageLoader";
import Opportunities from "./pages/OpportunitiesPage";
import Awards from "./pages/AwardsPage";
import InboxItemDetail from "./pages/InboxItemDetail";
import OpportunityDetail from "./pages/OpportunityDetail";
import AwardDetail from "./pages/AwardDetail";
import NotFoundPage from "./pages/NotFoundPage";

function App() {
  const { isSignedIn, isLoaded } = useAuth();

  if(!isLoaded) return <PageLoader />;

  // Inbox
// Market Intelligence
// Analytics
// Calendar
// Contacts
// Admin
  return (
    <Routes>
      <Route path="/login"
      element={isSignedIn? <Navigate to={"/dashboard"} /> : <LoginPage />} />
      <Route path="/" element={isSignedIn ? <DashboardLayout /> : <Navigate to={"/login"} /> }>
        <Route path = "dashboard" element = {<DashboardPage />} />
        <Route path = "inbox" element = {<InboxPage />} />
        <Route path="market-intelligence" element={<MarketIntelligencePage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="opportunities" element={<Opportunities />} />
        <Route path="opportunities/:id" element={<OpportunityDetail />} />
        <Route path="awards" element={<Awards />} />
        <Route path="awards/:id" element={<AwardDetail />} />
        <Route path="inbox/:id" element={<InboxItemDetail />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
