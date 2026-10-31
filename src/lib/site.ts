// Public links. The Pine twins live in the tester repo; set REPO_URL to null to hide those links while the repo
// is private.
export const REPO_URL: string | null = "https://github.com/mrullldhm/ttt";
export const repoFile = (path: string) => (REPO_URL ? `${REPO_URL}/blob/main/${path}` : null);
