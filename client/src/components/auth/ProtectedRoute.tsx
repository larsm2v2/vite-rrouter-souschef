import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import apiClient from '../pages/Client';

interface ProtectedRouteProps {
  children: ReactNode;
}

// Keep a cache of the last auth check to prevent constant rechecking
const authCache = {
  isAuthenticated: null as boolean | null,
  lastChecked: 0,
  // Cache valid for 5 minutes (300000ms)
  expiryTime: 300000
};

/**
 * A wrapper component that protects routes requiring authentication
 */
const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(authCache.isAuthenticated);
  const [isLoading, setIsLoading] = useState(authCache.isAuthenticated === null);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    // If we have a recent auth check in cache, use it
    const now = Date.now();
    if (authCache.isAuthenticated !== null && now - authCache.lastChecked < authCache.expiryTime) {
      setIsAuthenticated(authCache.isAuthenticated);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let isActive = true; // Flag to track if component is still mounted

    const checkAuth = async () => {
      try {
        const { data } = await apiClient.get('/auth/check', { 
          withCredentials: true,
          signal: controller.signal
        });
        
        // Only update state if component is still mounted
        if (isActive) {
          // Update both component state and cache
          setIsAuthenticated(data.authenticated);
          authCache.isAuthenticated = data.authenticated;
          authCache.lastChecked = Date.now();
          setIsLoading(false);
        }
      } catch (error: any) {
        // Only handle error if component is still mounted and error isn't from cancellation
        if (isActive && error.name !== 'CanceledError' && error.code !== 'ERR_CANCELED') {
          console.error('Auth check failed:', error);
          
          // Clear cache on error
          authCache.isAuthenticated = false;
          authCache.lastChecked = Date.now();
          
          setError(error.isConnectionError 
            ? 'Cannot connect to server'
            : 'Authentication check failed');
          setIsAuthenticated(false);
          setIsLoading(false);
        }
      }
    };

    // Only do the check if needed
    if (isAuthenticated === null) {
      checkAuth();
    } else {
      setIsLoading(false);
    }

    // Cleanup function
    return () => {
      isActive = false; // Mark component as unmounted
      controller.abort(); // Cancel any in-flight requests
    };
  }, [location.pathname]); // Only recheck when the path changes

  // While checking authentication status, show loading
  if (isLoading) {
    return <div className="loading">Checking authentication...</div>;
  }

  // If error occurred
  if (error) {
    return <div className="error-message">{error}</div>;
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If authenticated, render the protected content
  return <>{children}</>;
};

export default ProtectedRoute; 