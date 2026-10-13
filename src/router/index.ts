import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteComponent, RouteRecordRaw, Router } from 'vue-router';

/* Layout */
const Layout = (): RouteComponent => import('@/layout/index.vue');

export const constantRoutes: RouteRecordRaw[] = [
  {
    path: '/redirect',
    component: Layout,
    meta: { hidden: true },
    children: [
      {
        path: '/redirect/:path(.*)',
        component: () => import('@/views/redirect/index.vue')
      }
    ]
  },
  {
    path: '/login',
    component: () => import('@/views/login/index.vue'),
    meta: { hidden: true }
  },
  {
    path: '/auth-redirect',
    component: () => import('@/views/login/auth-redirect.vue'),
    meta: { hidden: true }
  },
  {
    path: '/404',
    component: () => import('@/views/error-page/404.vue'),
    meta: { hidden: true }
  },
  {
    path: '/401',
    component: () => import('@/views/error-page/401.vue'),
    meta: { hidden: true }
  },
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        name: 'Dashboard',
        meta: { title: 'Dashboard', icon: 'dashboard', affix: true }
      }
    ]
  },
  {
    path: '/profile',
    component: Layout,
    redirect: '/profile/index',
    meta: { hidden: true },
    children: [
      {
        path: 'index',
        component: () => import('@/views/profile/index.vue'),
        name: 'Profile',
        meta: { title: 'Profile', icon: 'user', noCache: true }
      }
    ]
  },

];

export const asyncRoutes: RouteRecordRaw[] = [
  {
    path: '/sdui',
    component: Layout,
    redirect: '/sdui/terminal',
    name: 'Sdui',
    meta: {
      title: 'SDUI Console',
      icon: 'component',
      roles: ['admin', 'editor', 'guest', 'sdui_only']
    },
    children: [
      {
        path: 'agent-access',
        name: 'SduiAgentAccess',
        component: () => import('@/views/sdui/agent/AgentAccess.vue'),
        meta: { title: 'Agent 接入', icon: 'link', roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'terminal',
        name: 'SduiTerminal',
        component: () => import('@/views/sdui/terminal/TerminalList.vue'),
        meta: { title: '终端管理', icon: 'monitor', roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'terminal/:deviceId',
        name: 'SduiTerminalDetail',
        component: () => import('@/views/sdui/terminal/TerminalDetail.vue'),
        meta: { title: '终端详情', hidden: true, roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'debug',
        name: 'SduiDebug',
        component: () => import('@/views/sdui/debug.vue'),
        meta: { title: '调试台', icon: 'tools', roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'businesses',
        name: 'SduiBusinesses',
        component: () => import('@/views/sdui/business/BusinessLibrary.vue'),
        meta: { title: '业务', icon: 'operation', roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'deployments',
        name: 'SduiDeployments',
        component: () => import('@/views/sdui/business/DeploymentLibrary.vue'),
        meta: { title: '部署', icon: 'upload', roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'businesses/:businessId',
        name: 'SduiBusinessEditor',
        component: () => import('@/views/sdui/business/BusinessEditor.vue'),
        meta: { title: '业务编辑', hidden: true, roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'deployments/:deploymentId',
        name: 'SduiDeploymentDetail',
        component: () => import('@/views/sdui/business/DeploymentDetail.vue'),
        meta: { title: '部署详情', hidden: true, roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'runs/:runId',
        name: 'SduiRunDetail',
        component: () => import('@/views/sdui/business/RunDetail.vue'),
        meta: { title: '运行详情', hidden: true, roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
    ]
  },
  {
    path: '/agent',
    component: Layout,
    meta: {
      title: 'Agent Management',
      icon: 'component',
      roles: ['guest']
    },
    children: [
      {
        path: 'list',
        component: () => import('@/views/agent/index.vue'),
        name: 'AgentList',
        meta: { title: 'Agent List', icon: 'list', roles: ['admin', 'editor', 'guest'] }
      }
    ]
  },
  {
    path: '/ai-chat',
    component: Layout,
    meta: { roles: ['guest'] },
    children: [
      {
        path: 'index',
        name: 'AiChat',
        component: () => import('@/views/ai-chat/index.vue'),
        meta: {
          title: 'AI Chat',
          icon: 'wechat',
          roles: ['admin', 'editor', 'guest']
        }
      }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/404', meta: { hidden: true }}
];

const createTheRouter = (): Router =>
  createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    scrollBehavior: () => ({ top: 0 }),
    routes: constantRoutes
  });

interface RouterPro extends Router {
  matcher: unknown;
}

const router = createTheRouter() as RouterPro;

export function resetRouter() {
  const newRouter = createTheRouter() as RouterPro;
  router.matcher = newRouter.matcher;
}

export default router;
