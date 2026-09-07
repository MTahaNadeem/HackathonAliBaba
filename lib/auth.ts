export function authRedirectTo(path = '/auth/reset') {
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

export function isAuthHash(hash: string) {
  const value = hash.startsWith('#') ? hash.slice(1) : hash;
  return /access_token=|refresh_token=|type=recovery|type=signup|type=invite|type=magiclink|error_description=/.test(value);
}

export function friendlyAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Something went wrong. Try again.';
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'That email or password is not correct.';
  if (lower.includes('email not confirmed')) return 'Please confirm your email first. You can resend the confirmation below.';
  if (lower.includes('user already registered')) return 'An account with this email already exists. Sign in, or reset your password.';
  if (lower.includes('password should be at least')) return 'Use a password of at least 8 characters.';
  if (lower.includes('same as the old password')) return 'Choose a password you have not used before.';
  if (lower.includes('expired') || lower.includes('invalid token')) return 'This reset link has expired. Request a new one.';
  if (lower.includes('rate limit') || lower.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
  if (lower.includes('unable to validate email')) return 'Enter a valid email address.';
  return message;
}
