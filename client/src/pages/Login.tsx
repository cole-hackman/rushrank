import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Redirect } from 'wouter'
import { AuthDebug } from '@/components/AuthDebug'

export default function Login() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const { user, signInWithMagicLink } = useAuth()
  const { toast } = useToast()

  // Redirect if already logged in
  if (user) {
    return <Redirect to="/dashboard" />
  }

  const handleMagicLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsLoading(true)
    try {
      await signInWithMagicLink(email)
      setEmailSent(true)
      toast({
        title: "Check your email",
        description: "We've sent you a magic link to sign in. Click the link in your email to complete authentication.",
      })
    } catch (error: any) {
      console.error('Magic link sign in error:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to send magic link",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-blue-950 dark:to-purple-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">RushRank</CardTitle>
          <CardDescription>
            Sign in to access your chapter's rush voting platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailSent ? (
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                We've sent a magic link to <strong>{email}</strong>. 
                Check your email and click the link to sign in.
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleMagicLinkSignIn} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || !email}
                data-testid="button-signin"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending magic link...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Sign in with Magic Link
                  </>
                )}
              </Button>
            </form>
          )}
          
          <div className="text-center text-sm text-muted-foreground">
            {emailSent ? (
              <button
                onClick={() => setEmailSent(false)}
                className="text-primary hover:underline"
              >
                Use a different email
              </button>
            ) : (
              <p>
                We'll send you a secure link to sign in instantly
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <AuthDebug />
    </div>
  )
}