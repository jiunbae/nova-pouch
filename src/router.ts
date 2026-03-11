/* router.ts — Lightweight client-side router for clean URLs */

type RouteHandler = (params: Record<string, string>) => void;

interface Route {
  pattern: RegExp;
  keys: string[];
  handler: RouteHandler;
}

const routes: Route[] = [];

export function route(path: string, handler: RouteHandler): void {
  const keys: string[] = [];
  const pattern = path
    .replace(/:([^/]+)/g, (_, key) => {
      keys.push(key);
      return '([^/]+)';
    })
    .replace(/\//g, '\\/');
  routes.push({ pattern: new RegExp(`^${pattern}$`), keys, handler });
}

export function resolve(pathname: string): boolean {
  for (const r of routes) {
    const match = pathname.match(r.pattern);
    if (match) {
      const params: Record<string, string> = {};
      r.keys.forEach((key, i) => {
        params[key] = decodeURIComponent(match[i + 1]);
      });
      r.handler(params);
      return true;
    }
  }
  return false;
}

/** Push a clean URL without triggering popstate */
export function navigate(path: string, replace = false): void {
  if (window.location.pathname === path) return;
  if (replace) {
    window.history.replaceState({ route: path }, '', path);
  } else {
    window.history.pushState({ route: path }, '', path);
  }
}
