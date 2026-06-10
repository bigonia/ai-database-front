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
        path: 'devices',
        redirect: '/sdui/terminal',
        meta: { hidden: true, roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'debug',
        name: 'SduiDebug',
        component: () => import('@/views/sdui/debug.vue'),
        meta: { title: '调试台', icon: 'tools', roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'catalog',
        name: 'SduiCatalog',
        component: () => import('@/views/sdui/catalog.vue'),
        meta: { title: '能力目录', hidden: true, roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'overview',
        redirect: '/sdui/terminal',
        meta: { hidden: true, roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'management',
        redirect: '/sdui/catalog',
        meta: { hidden: true, roles: ['admin', 'editor', 'guest', 'sdui_only'] }
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
