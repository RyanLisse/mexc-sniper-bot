"use client";

import { useSupabaseAuth } from '@/src/components/auth/supabase-auth-provider-clean';
import { AuthStatusChecker } from '@/src/components/auth/auth-status-checker';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { useState } from 'react';

export default function AuthTestPage() {
  const { user, session, isLoading, isHydrated, signIn, signUp, signOut, signInWithProvider } = useSupabaseAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningIn(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        console.error('Sign in error:', error);
        alert(`Sign in failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Unexpected sign in error:', error);
      alert('An unexpected error occurred');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningIn(true);
    try {
      const { error } = await signUp(email, password);
      if (error) {
        console.error('Sign up error:', error);
        alert(`Sign up failed: ${error.message}`);
      } else {
        alert('Check your email to confirm your account');
      }
    } catch (error) {
      console.error('Unexpected sign up error:', error);
      alert('An unexpected error occurred');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    try {
      const { error } = await signInWithProvider(provider);
      if (error) {
        console.error(`${provider} sign in error:`, error);
        alert(`${provider} sign in failed: ${error.message}`);
      }
    } catch (error) {
      console.error(`Unexpected ${provider} sign in error:`, error);
      alert('An unexpected error occurred');
    }
  };

  const handleSignOut = async () => {
    try {
      const error = await signOut();
      if (error) {
        console.error('Sign out error:', error);
        alert(`Sign out failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Unexpected sign out error:', error);
      alert('An unexpected error occurred');
    }
  };

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Test - Signed In</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>User ID:</Label>
              <p className="text-sm text-muted-foreground break-all">{user.id}</p>
            </div>
            <div>
              <Label>Email:</Label>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div>
              <Label>Email Verified:</Label>
              <p className="text-sm text-muted-foreground">
                {user.email_confirmed_at ? 'Yes' : 'No'}
              </p>
            </div>
            <div>
              <Label>Session:</Label>
              <p className="text-sm text-muted-foreground">
                {session ? 'Active' : 'None'}
              </p>
            </div>
            <Button onClick={handleSignOut} className="w-full">
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl space-y-6">
        <AuthStatusChecker />
        
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Authentication Test</CardTitle>
          </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="test@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Password"
              />
            </div>
            <div className="flex space-x-2">
              <Button 
                type="submit" 
                disabled={isSigningIn}
                className="flex-1"
              >
                {isSigningIn ? 'Signing In...' : 'Sign In'}
              </Button>
              <Button 
                type="button" 
                onClick={handleSignUp}
                disabled={isSigningIn}
                variant="outline"
                className="flex-1"
              >
                {isSigningIn ? 'Signing Up...' : 'Sign Up'}
              </Button>
            </div>
          </form>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button 
              onClick={() => handleOAuthSignIn('google')}
              variant="outline"
              className="flex-1"
            >
              Google
            </Button>
            <Button 
              onClick={() => handleOAuthSignIn('github')}
              variant="outline"
              className="flex-1"
            >
              GitHub
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground">
            <p>Test User: ryan@ryanlisse.com</p>
            <p>Password: Testing2025!</p>
          </div>
        </CardContent>
        </Card>
      </div>
    </div>
  );
}