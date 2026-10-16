let redirecting = false;
export async function authFetch(url, options) {
  const response = await fetch(url, options);
  if (response.status === 401 && !redirecting) {
    redirecting = true;
    location.replace(`/auth/login?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`);
  }
  return response;
}
if (typeof window !== 'undefined') window.addEventListener('pageshow', event => {
  if (event.persisted) location.reload();
});
