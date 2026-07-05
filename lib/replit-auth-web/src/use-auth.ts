import { useUser, useClerk } from "@clerk/clerk-react";
import { useCallback } from "react";

export interface AuthUser {
  id: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  role: "tutor" | "student" | "parent" | "pending";
}

export type { AuthUser as AuthUser };

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

export function useAuth(): AuthState {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { openSignIn, signOut } = useClerk();

  const login = useCallback(() => {
    openSignIn();
  }, [openSignIn]);

  const logout = useCallback(() => {
    signOut();
  }, [signOut]);

  if (!isLoaded) {
    return { user: null, isLoading: true, isAuthenticated: false, login, logout };
  }

  if (!isSignedIn || !clerkUser) {
    return { user: null, isLoading: false, isAuthenticated: false, login, logout };
  }

  const role = (clerkUser.publicMetadata?.role as "tutor" | "student" | "parent" | "pending") ?? "pending";

  const user: AuthUser = {
    id: clerkUser.id,
    username: clerkUser.username,
    firstName: clerkUser.firstName,
    lastName: clerkUser.lastName,
    profileImageUrl: clerkUser.imageUrl ?? null,
    role,
  };

  return { user, isLoading: false, isAuthenticated: true, login, logout };
}
