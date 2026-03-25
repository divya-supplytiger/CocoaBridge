import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from "react-router";
import {ClerkProvider} from '@clerk/clerk-react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Toaster } from "react-hot-toast";

import './index.css';
import App from './App.jsx';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk publishable key");
}

// create a react-query client
const STALE_TIME = import.meta.env.VITE_ENV === "development" ? Infinity : 30 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME,
      gcTime: STALE_TIME,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} >
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
      <Toaster position="top-center" />
    </ClerkProvider>
    </BrowserRouter>
  </StrictMode>,
);
