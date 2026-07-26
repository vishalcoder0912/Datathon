import {Navigate, Outlet, useLocation} from "react-router-dom";
import StatusPanel from "@/shared/layout/StatusPanel";
import {useAuth} from "@/auth/AuthProvider";
import type {KavachRole} from "@/kavach/api/types";

interface ProtectedRouteProps {
  roles?: KavachRole[];
}

export default function ProtectedRoute({roles}: ProtectedRouteProps) {
  const location = useLocation();
  const {isAuthenticated, isLoading, user} = useAuth();

  if (isLoading) {
    return <StatusPanel title="Checking access" message="Loading your KAVACH AI session." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{from: location.pathname}} />;
  }

  if (roles && user && !roles.includes(user.roleCode)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
