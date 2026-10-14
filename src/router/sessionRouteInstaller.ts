export function createSessionRouteInstaller<Route>(options: {
  generateRoutes: (roles: string[]) => Promise<Route[]> | Route[];
  addRoute: (route: Route) => unknown;
  isCurrent: (token: string, generation: number) => boolean;
}) {
  let installedGeneration = -1;
  let pending: { generation: number; promise: Promise<boolean> } | undefined;

  return async (roles: string[], token: string, generation: number): Promise<boolean> => {
    if (installedGeneration === generation) return false;
    if (pending?.generation === generation) return pending.promise;

    const promise = (async () => {
      const routes = await options.generateRoutes(roles);
      if (!options.isCurrent(token, generation)) return false;
      routes.forEach(options.addRoute);
      installedGeneration = generation;
      return true;
    })();
    const operation = { generation, promise };
    pending = operation;
    try {
      return await promise;
    } finally {
      if (pending === operation) pending = undefined;
    }
  };
}
