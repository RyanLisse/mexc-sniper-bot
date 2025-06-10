"use client";

import { authClient } from "@/src/lib/auth-client";
import { useState } from "react";

// Example: Sign Up with Email and Username
export const SignUpExample = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    username: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      const { data, error } = await authClient.signUp.email({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        username: formData.username,
      });

      if (error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage(
          `Success! User created: ${data.user.email} (${(data.user as any).username || data.user.name})`
        );
      }
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Unknown error occurred"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded">
      <h3 className="text-lg font-semibold mb-4">Sign Up with Email & Username</h3>
      <form onSubmit={handleSignUp} className="space-y-3">
        <input
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="text"
          placeholder="Username (3-30 chars)"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          className="w-full p-2 border rounded"
          minLength={3}
          maxLength={30}
          required
        />
        <input
          type="text"
          placeholder="Full Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Password (8+ chars)"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          className="w-full p-2 border rounded"
          minLength={8}
          required
        />
        <button
          type="submit"
          disabled={isLoading}
          className="w-full p-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {isLoading ? "Creating Account..." : "Sign Up"}
        </button>
      </form>
      {message && (
        <div
          className={`mt-3 p-2 rounded ${message.startsWith("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
        >
          {message}
        </div>
      )}
    </div>
  );
};

// Example: Sign In with Username or Email
export const SignInExample = () => {
  const [loginData, setLoginData] = useState({
    identifier: "", // Can be email or username
    password: "",
  });
  const [loginMethod, setLoginMethod] = useState<"email" | "username">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      let result;
      if (loginMethod === "username") {
        result = await authClient.signIn.username({
          username: loginData.identifier,
          password: loginData.password,
        });
      } else {
        result = await authClient.signIn.email({
          email: loginData.identifier,
          password: loginData.password,
        });
      }

      const { data, error } = result;

      if (error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage(`Success! Welcome back, ${data.user.name}!`);
        // Trigger auth state change event
        window.dispatchEvent(new CustomEvent("auth-state-change"));
      }
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Unknown error occurred"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded">
      <h3 className="text-lg font-semibold mb-4">Sign In</h3>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Login Method:</label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="email"
              checked={loginMethod === "email"}
              onChange={(e) => setLoginMethod(e.target.value as "email" | "username")}
              className="mr-2"
            />
            Email
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="username"
              checked={loginMethod === "username"}
              onChange={(e) => setLoginMethod(e.target.value as "email" | "username")}
              className="mr-2"
            />
            Username
          </label>
        </div>
      </div>

      <form onSubmit={handleSignIn} className="space-y-3">
        <input
          type={loginMethod === "email" ? "email" : "text"}
          placeholder={loginMethod === "email" ? "Email" : "Username"}
          value={loginData.identifier}
          onChange={(e) => setLoginData({ ...loginData, identifier: e.target.value })}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={loginData.password}
          onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
          className="w-full p-2 border rounded"
          required
        />
        <button
          type="submit"
          disabled={isLoading}
          className="w-full p-2 bg-green-600 text-white rounded disabled:opacity-50"
        >
          {isLoading ? "Signing In..." : "Sign In"}
        </button>
      </form>
      {message && (
        <div
          className={`mt-3 p-2 rounded ${message.startsWith("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
        >
          {message}
        </div>
      )}
    </div>
  );
};

// Example: Forgot Password Flow
export const ForgotPasswordExample = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      await authClient.forgetPassword({
        email,
        redirectTo: "/reset-password", // URL where user will reset password
      });

      setMessage("Password reset email sent! Check your inbox for reset instructions.");
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Unknown error occurred"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded">
      <h3 className="text-lg font-semibold mb-4">Forgot Password</h3>
      <form onSubmit={handleForgotPassword} className="space-y-3">
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
        <button
          type="submit"
          disabled={isLoading}
          className="w-full p-2 bg-orange-600 text-white rounded disabled:opacity-50"
        >
          {isLoading ? "Sending Reset Email..." : "Send Reset Email"}
        </button>
      </form>
      {message && (
        <div
          className={`mt-3 p-2 rounded ${message.startsWith("Error") ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}
        >
          {message}
        </div>
      )}
    </div>
  );
};

// Example: Reset Password (would be used on reset-password page)
export const ResetPasswordExample = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setMessage("Error: Passwords do not match");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      // Get token from URL params
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get("token");

      if (!token) {
        setMessage("Error: Invalid or missing reset token");
        return;
      }

      await authClient.resetPassword({
        newPassword,
        token,
      });

      setMessage("Password reset successful! You can now sign in with your new password.");
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Unknown error occurred"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded">
      <h3 className="text-lg font-semibold mb-4">Reset Password</h3>
      <form onSubmit={handleResetPassword} className="space-y-3">
        <input
          type="password"
          placeholder="New Password (8+ chars)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full p-2 border rounded"
          minLength={8}
          required
        />
        <input
          type="password"
          placeholder="Confirm New Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full p-2 border rounded"
          minLength={8}
          required
        />
        <button
          type="submit"
          disabled={isLoading}
          className="w-full p-2 bg-purple-600 text-white rounded disabled:opacity-50"
        >
          {isLoading ? "Resetting Password..." : "Reset Password"}
        </button>
      </form>
      {message && (
        <div
          className={`mt-3 p-2 rounded ${message.startsWith("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
        >
          {message}
        </div>
      )}
    </div>
  );
};

// Example: Update Username
export const UpdateUsernameExample = () => {
  const [newUsername, setNewUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      const { data, error } = await authClient.updateUser({
        username: newUsername,
      });

      if (error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage(
          `Username updated successfully to: ${(data as any).user?.username || "username updated"}`
        );
        setNewUsername("");
      }
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Unknown error occurred"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded">
      <h3 className="text-lg font-semibold mb-4">Update Username</h3>
      <form onSubmit={handleUpdateUsername} className="space-y-3">
        <input
          type="text"
          placeholder="New Username (3-30 chars)"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          className="w-full p-2 border rounded"
          minLength={3}
          maxLength={30}
          required
        />
        <button
          type="submit"
          disabled={isLoading}
          className="w-full p-2 bg-indigo-600 text-white rounded disabled:opacity-50"
        >
          {isLoading ? "Updating..." : "Update Username"}
        </button>
      </form>
      {message && (
        <div
          className={`mt-3 p-2 rounded ${message.startsWith("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
        >
          {message}
        </div>
      )}
    </div>
  );
};
