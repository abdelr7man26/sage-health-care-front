import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from "../context/AuthContext";
/**
 * ProtectedRoute
 *
 * Prevents unauthenticated users from accessing any wrapped route.
 * Also supports role-based access control via the `allowedRoles` prop.
 *
 * Usage in App.jsx:
 *   <Route path="/dashboard" element={
 *     <ProtectedRoute allowedRoles={['patient', 'doctor']}>
 *       <Dashboard />
 *     </ProtectedRoute>
 *   } />
 */
const Spinner = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0b2d20] to-[#1a4d35]">
        <div className="w-10 h-10 border-4 border-[#134e3a] border-t-transparent rounded-full animate-spin" />
    </div>
);

const ProtectedRoute = ({ children, allowedRoles }) => {
    const { isAuthenticated, user, loading } = useAuth();
    const location = useLocation();

    // Wait for the initial /auth/refresh call to resolve before deciding
    if (loading) return <Spinner />;

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user?.role)) {
        return <Navigate to="/unauthorized" replace />;
    }

    return children;
};

export default ProtectedRoute;