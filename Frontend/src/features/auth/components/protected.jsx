import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

/**
 * Wraps private routes. Waits for the initial session check to finish (loading) before deciding whether to redirect, so a page refresh doesn't briefly bounce a logged-in user to /login.
 */
function Protected() {
  const { user, loading } = useAuth();

  if (loading) return <div className="page-loader">Loading...</div>;

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export default Protected;