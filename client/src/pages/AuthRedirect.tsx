import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AuthRedirect() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');
  const [tokenData, setTokenData] = useState<any>(null);

  useEffect(() => {
    const handleAuthRedirect = async () => {
      try {
        // Parse tokens from URL hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const tokenType = hashParams.get('token_type');
        const expiresAt = hashParams.get('expires_at');

        setTokenData({
          accessToken: accessToken?.substring(0, 20) + '...',
          refreshToken: refreshToken?.substring(0, 20) + '...',
          tokenType,
          expiresAt: new Date(parseInt(expiresAt || '0') * 1000).toLocaleString()
        });

        if (!accessToken || !refreshToken) {
          setStatus('error');
          setMessage('Invalid authentication tokens');
          return;
        }

        setMessage('Setting up your session...');

        // Set the session
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) {
          console.error('Session error:', error);
          setStatus('error');
          setMessage(`Authentication failed: ${error.message}`);
          return;
        }

        if (data.session && data.user) {
          setStatus('success');
          setMessage(`Welcome back, ${data.user.email}!`);
          
          // Clean up URL and redirect after a short delay
          setTimeout(() => {
            window.history.replaceState(null, '', window.location.pathname);
            setLocation('/dashboard');
          }, 2000);
        } else {
          setStatus('error');
          setMessage('Failed to create session');
        }

      } catch (error) {
        console.error('Auth redirect error:', error);
        setStatus('error');
        setMessage('An unexpected error occurred');
      }
    };

    // Only run if there are tokens in the URL
    if (window.location.hash.includes('access_token')) {
      handleAuthRedirect();
    } else {
      setStatus('error');
      setMessage('No authentication tokens found');
    }
  }, [setLocation]);

  const handleRetry = () => {
    setLocation('/login');
  };

  const handleContinue = () => {
    setLocation('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-blue-950 dark:to-purple-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {status === 'processing' && (
              <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
            )}
            {status === 'success' && (
              <CheckCircle className="h-12 w-12 text-green-600" />
            )}
            {status === 'error' && (
              <XCircle className="h-12 w-12 text-red-600" />
            )}
          </div>
          <CardTitle className="text-xl">
            {status === 'processing' && 'Authenticating'}
            {status === 'success' && 'Success!'}
            {status === 'error' && 'Authentication Failed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-gray-600 dark:text-gray-400">
            {message}
          </p>

          {tokenData && (
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-xs space-y-1">
              <div><strong>Token Type:</strong> {tokenData.tokenType}</div>
              <div><strong>Access Token:</strong> {tokenData.accessToken}</div>
              <div><strong>Refresh Token:</strong> {tokenData.refreshToken}</div>
              <div><strong>Expires:</strong> {tokenData.expiresAt}</div>
            </div>
          )}

          <div className="flex gap-2">
            {status === 'error' && (
              <Button onClick={handleRetry} className="flex-1">
                Try Again
              </Button>
            )}
            {status === 'success' && (
              <Button onClick={handleContinue} className="flex-1">
                Continue to Dashboard
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}