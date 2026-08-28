import "server-only";

export type Reviewer = { id: string; email: string };

/**
 * For basic password auth, we return a dummy reviewer object.
 * The actual auth happens on the client via localStorage check.
 * This is a simple setup — for production, use proper session management.
 */
export async function getReviewer(): Promise<Reviewer | null> {
  // In a server context, we can't check localStorage.
  // The middleware handles the redirect if not logged in.
  // This always returns a valid reviewer to skip auth on server-side page loads.
  return { id: "reviewer", email: "reviewer@enpal.local" };
}
