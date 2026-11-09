export function isSameOriginPath(path: string | null | undefined): path is string {
  if (!path?.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return false;
  }

  // URL parsers can strip controls or treat backslashes as slashes. Reject them
  // before parsing rather than letting a malformed path turn into an authority.
  for (const character of path) {
    const code = character.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return false;
  }

  try {
    const origin = "https://tiki.invalid";
    return new URL(path, origin).origin === origin;
  } catch {
    return false;
  }
}

export function redirectToPath(path: string) {
  if (!isSameOriginPath(path)) {
    throw new Error("Redirect target must be a same-origin path.");
  }

  // Keep Location relative so reverse proxies such as Netlify cannot replace the
  // visitor's custom hostname with an internal deploy hostname.
  return new Response(null, {
    status: 303,
    headers: { Location: path },
  });
}
