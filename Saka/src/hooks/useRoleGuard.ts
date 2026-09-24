import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';

/**
 * Redirects to /Login if no authenticated user.
 * No-op while the auth store is still resolving the session.
 */
export function useRequireAuth() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/Login');
    }
  }, [user, isLoading, router]);
}

/**
 * Redirects:
 *  - to /Login if not signed in
 *  - to /Home if signed in but role is not organization (admins are allowed)
 */
export function useRequireOrganization() {
  const router = useRouter();
  const { user, profile, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/Login');
      return;
    }
    if (!profile) return; // profile still loading

    const role = profile.role ?? (profile.is_admin ? 'admin' : 'hiker');
    if (role !== 'organization' && role !== 'admin') {
      router.replace('/Home');
    }
  }, [user, profile, isLoading, router]);
}