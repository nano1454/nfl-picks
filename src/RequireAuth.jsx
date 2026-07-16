import { Navigate, useLocation } from "react-router-dom";
import { getSession } from "./auth";

export default function RequireAuth({ children }) {
  const session = getSession();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
