import { defineStore } from 'pinia';
import { asyncRoutes, constantRoutes } from '@/router';
import type { RouteRecordRaw } from 'vue-router';

interface IPermissionState {
  routes: Array<RouteRecordRaw>;
  addRoutes: Array<RouteRecordRaw>;
}

/**
 * Use meta.role to determine if the current user has permission
 * @param roles
 * @param route
 */
function hasPermission(roles:string[], route:RouteRecordRaw):boolean {
  if (route.meta && route.meta.roles) {
    const rolesArr = route.meta.roles as string[];
    return roles.some(role => rolesArr.includes(role));
  } else {
    // 对于没有明确设置权限的路由，只有特权用户（如admin）可以访问
    // 这里假设admin是特权用户，可以访问所有未明确限制的路由
    return roles.includes('admin');
    // return true; // 允许所有用户访问没有明确权限设置的路由
  }
}

/**
 * Filter asynchronous routing tables by recursion
 * @param routes asyncRoutes
 * @param roles
 */
export function filterAsyncRoutes(routes:RouteRecordRaw[], roles: string[]): Array<RouteRecordRaw> {
  const res:Array<RouteRecordRaw> = [];

  routes.forEach(route => {
    const tmp = { ...route };
    if (hasPermission(roles, tmp)) {
      if (tmp.children) {
        tmp.children = filterAsyncRoutes(tmp.children, roles);
      }
      res.push(tmp);
    }
  });

  return res;
}

export default defineStore({
  id: 'permission',
  state: ():IPermissionState => ({
    routes: [],
    addRoutes: []
  }),
  getters: {},
  actions: {
    setRoutes(routes: RouteRecordRaw[]) {
      this.addRoutes = routes;
      this.routes = constantRoutes.concat(routes);
    },
    generateRoutes(roles: string[]) {
      let accessedRoutes;
      if (roles.includes('admin')) {
        accessedRoutes = asyncRoutes || [];
      } else {
        accessedRoutes = filterAsyncRoutes(asyncRoutes, roles);
      }
      this.setRoutes(accessedRoutes);
      return accessedRoutes;
    }
  }
});
