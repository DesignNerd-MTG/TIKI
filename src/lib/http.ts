export function redirectToPath(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Redirect target must be a same-origin path.");
  }

  // Keep Location relative so reverse proxies such as Netlify cannot replace the
  // visitor's custom hostname with an internal deploy hostname.
  return new Response(null, {
    status: 303,
    headers: { Location: path },
  });
}
