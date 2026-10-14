interface RouteRegistry<TRoute> {
  addRoute: (route: TRoute) => () => void;
}

export function createRouteResetter<TRoute>(router: RouteRegistry<TRoute>) {
  const removers = new Set<() => void>();

  return {
    add(route: TRoute) {
      const remove = router.addRoute(route);
      removers.add(remove);
      return () => {
        if (removers.delete(remove)) remove();
      };
    },
    reset() {
      for (const remove of removers) remove();
      removers.clear();
    }
  };
}
