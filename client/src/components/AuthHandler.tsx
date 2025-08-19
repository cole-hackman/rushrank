import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function AuthHandler() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    // Handle magic link callback on any page
    const handleAuthCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      if (accessToken && refreshToken && !user) {
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (error) {
            console.error('Auth callback error:', error);
            setLocation('/login?error=auth_failed');
          } else if (data.session) {
            // Clean up URL
            window.location.hash = '';
            // Redirect to dashboard
            setLocation('/dashboard');
          }
        } catch (error) {
          console.error('Session setting error:', error);
          setLocation('/login?error=session_failed');
        }
      }
    };

    handleAuthCallback();
  }, [setLocation, user]);

  return null;
}