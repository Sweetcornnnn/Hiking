export function getAuthErrorMessage(error: unknown, fallback: string): string {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : '';
  const normalized = message.toLowerCase();

  if (
    /network|fetch|offline|timed?\s*out|connection|internet|econn|enotfound|unable to resolve host/.test(
      normalized,
    )
  ) {
    return 'Connection failed. Check your internet connection and try again.';
  }

  if (/invalid login credentials|invalid email or password/.test(normalized)) {
    return 'Email or password is incorrect.';
  }

  if (/already registered|user already exists/.test(normalized)) {
    return 'An account with this email already exists. Try signing in instead.';
  }

  if (/too many requests|rate limit/.test(normalized)) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  if (/user not found/.test(normalized)) {
    return 'No account exists for this email. Check it or sign up first.';
  }

  if (/supabase .*not configured|email auth is not configured/.test(normalized)) {
    return message;
  }

  return fallback;
}
