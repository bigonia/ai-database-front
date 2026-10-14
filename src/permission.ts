import router, { addSessionRoute } from './router';
import userStore from './store/modules/user';
import permissionStore from './store/modules/permission';
import { createSessionRouteInstaller } from './router/sessionRouteInstaller';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import { ElMessage } from 'element-plus';
import type { RouteRecordRaw } from 'vue-router';
import { getToken } from '@/utils/auth';
import getPageTitle from '@/utils/get-page-title';

NProgress.configure({ showSpinner: false });

const whiteList = ['/login', '/auth-redirect'];
const installSessionRoutes = createSessionRouteInstaller<RouteRecordRaw>({
  generateRoutes: roles => permissionStore().generateRoutes(roles),
  addRoute: route => addSessionRoute(route),
  isCurrent: (token, generation) => userStore().isSessionCurrent(token, generation)
});

router.beforeEach(async (to, _from, next) => {
  NProgress.start();
  document.title = getPageTitle(to.meta.title);

  const hasToken = getToken();
  const currentUser = userStore();
  const sessionGeneration = currentUser.sessionGeneration;
  const sessionToken = currentUser.token;

  if (!hasToken) {
    if (whiteList.includes(to.path)) {
      next();
    } else {
      NProgress.done();
      next(`/login?redirect=${to.fullPath}`);
    }
    return;
  }

  if (to.path === '/login') {
    NProgress.done();
    next({ path: '/' });
    return;
  }

  try {
    let roles = currentUser.roles;
    if (!roles.length) {
      const info = await currentUser.getInfo();
      if (!currentUser.isSessionCurrent(sessionToken, sessionGeneration)) {
        next({ path: to.fullPath, replace: true });
        return;
      }
      roles = info.roles as string[];
    }

    const routesInstalled = await installSessionRoutes(roles, sessionToken, sessionGeneration);
    if (!currentUser.isSessionCurrent(sessionToken, sessionGeneration)) {
      next({ path: to.fullPath, replace: true });
      return;
    }
    if (routesInstalled) {
      next({ ...to, replace: true });
      return;
    }

    const resolved = router.resolve(to.fullPath);
    const deepestMatched = resolved.matched.at(-1);
    if (!deepestMatched || deepestMatched.path === '/:pathMatch(.*)*') {
      next({ path: '/404', replace: true });
      return;
    }
    const denied = resolved.matched.some(record => {
      const allowedRoles = record.meta.roles as string[] | undefined;
      return Array.isArray(allowedRoles) && !roles.some(role => allowedRoles.includes(role));
    });
    if (denied) next({ path: '/401', replace: true });
    else next();
  } catch (error) {
    if (!currentUser.isSessionCurrent(sessionToken, sessionGeneration)) {
      next({ path: to.fullPath, replace: true });
      return;
    }
    await currentUser.resetToken();
    ElMessage.error(error instanceof Error ? error.message : 'Has Error');
    NProgress.done();
    next(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
  }
});

router.afterEach(() => {
  NProgress.done();
});
