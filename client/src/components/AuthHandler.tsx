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
      const authType = hashParams.get('type');
      
      console.log('Auth handler check:', { accessToken: !!accessToken, refreshToken: !!refreshToken, authType, currentPath: location });
      
      if (accessToken && refreshToken && authType === 'magiclink') {
        console.log('Processing magic link authentication...');
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (error) {
            console.error('Auth callback error:', error);
            setLocation('/login?error=auth_failed');
          } else if (data.session) {
            console.log('Session created successfully:', data.user?.email);
            // Clean up URL hash
            window.history.replaceState(null, '', window.location.pathname);
            // Redirect to dashboard
            setLocation('/dashboard');
          }
        } catch (error) {
          console.error('Session setting error:', error);
          setLocation('/login?error=session_failed');
        }
      }
    };

    // Run auth callback check
    handleAuthCallback();
  }, [setLocation, location]);

  return null;
}