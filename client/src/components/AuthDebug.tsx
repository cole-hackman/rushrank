import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function AuthDebug() {
  const { user, session, loading } = useAuth();

  if (loading) return null;

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle className="text-sm">Auth Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          <Badge variant={user ? "default" : "secondary"}>
            {user ? 'Authenticated' : 'Not Authenticated'}
          </Badge>
        </div>
        {user && (
          <>
            <div className="text-xs">
              <span className="font-medium">Email:</span> {user.email}
            </div>
            <div className="text-xs">
              <span className="font-medium">User ID:</span> {user.id}
            </div>
          </>
        )}
        {session && (
          <div className="text-xs">
            <span className="font-medium">Session:</span> Active
          </div>
        )}
      </CardContent>
    </Card>
  );
}