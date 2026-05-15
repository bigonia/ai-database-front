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
  }
];

export const asyncRoutes: RouteRecordRaw[] = [
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
  {
    path: '/datasource',
    component: Layout,
    redirect: '/datasource/list',
    name: 'Datasource',
    meta: {
      title: 'Datasource',
      icon: 'table',
      roles: ['admin', 'editor', 'guest']
    },
    children: [
      {
        path: 'list',
        name: 'DatasourceList',
        component: () => import('@/views/datasource/index.vue'),
        meta: { title: 'Datasource List', icon: 'table', roles: ['editor', 'guest'] }
      }
    ]
  },
  {
    path: '/sdui',
    component: Layout,
    redirect: '/sdui/overview',
    name: 'Sdui',
    meta: {
      title: 'SDUI Console',
      icon: 'component',
      roles: ['admin', 'editor', 'guest', 'sdui_only']
    },
    children: [
      {
        path: 'overview',
        name: 'SduiOverview',
        component: () => import('@/views/sdui/overview.vue'),
        meta: { title: 'Overview', icon: 'dashboard', roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'devices',
        name: 'SduiDevices',
        component: () => import('@/views/sdui/devices.vue'),
        meta: { title: 'Devices', icon: 'device', roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'workflows',
        name: 'SduiWorkflows',
        component: () => import('@/views/sdui/workflows.vue'),
        meta: { title: 'Workflows', icon: 'list', roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'editor/:id?',
        name: 'SduiEditor',
        component: () => import('@/views/sdui/editor.vue'),
        meta: { title: 'Editor', icon: 'list', hidden: true, roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      }
    ]
  },
  {
    path: '/file-ops',
    component: Layout,
    redirect: '/file-ops/manager',
    name: 'FileOps',
    meta: { title: 'File Manager', icon: 'documentation', roles: ['editor', 'guest'] },
    children: [
      {
        path: 'manager',
        name: 'FileManager',
        component: () => import('@/views/file-manager/index.vue'),
        meta: { title: 'File List', icon: 'documentation', roles: ['editor', 'guest'] }
      }
    ]
  },
  {
    path: '/domain-docs',
    component: Layout,
    redirect: '/domain-docs/list',
    name: 'DomainDocs',
    meta: {
      title: 'Domain Docs',
      icon: 'documentation',
      roles: ['editor', 'guest']
    },
    children: [
      {
        path: 'list',
        component: () => import('@/views/domain-docs/index.vue'),
        name: 'DomainDocList',
        meta: { title: 'Domain Documents', icon: 'list', noCache: true, roles: ['editor', 'guest'] }
      }
    ]
  },
  {
    path: '/knowledge',
    component: Layout,
    redirect: '/knowledge/list',
    name: 'KnowledgeBase',
    meta: {
      title: 'Knowledge Base',
      icon: 'documentation',
      roles: ['editor', 'guest']
    },
    children: [
      {
        path: 'list',
        component: () => import('@/views/knowledge/index.vue'),
        name: 'DocumentList',
        meta: { title: 'Vector Store', icon: 'list', roles: ['editor', 'guest'] }
      }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/404', meta: { hidden: true } }
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
