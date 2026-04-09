import { createRouter, createWebHashHistory } from 'vue-router';
import type { Router, RouteRecordRaw, RouteComponent } from 'vue-router';

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
        meta: { title: '首页', icon: 'dashboard', affix: true }
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
        meta: { title: '个人中心', icon: 'user', noCache: true }
      }
    ]
  }
];

export const asyncRoutes: RouteRecordRaw[] = [
  {
    path: '/agent',
    component: Layout,
    meta: {
      title: 'Agent 管理',
      icon: 'component',
      roles: ['guest']
    },
    children: [
      {
        path: 'list',
        component: () => import('@/views/agent/index.vue'),
        name: 'AgentList',
        meta: { title: 'Agent 列表', icon: 'list', roles: ['admin', 'editor', 'guest'] }
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
          title: 'AI 对话',
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
      title: '数据源管理',
      icon: 'table',
      roles: ['admin', 'editor', 'guest']
    },
    children: [
      {
        path: 'list',
        name: 'DatasourceList',
        component: () => import('@/views/datasource/index.vue'),
        meta: { title: '数据源列表', icon: 'table', roles: ['editor', 'guest'] }
      }
    ]
  },
  {
    path: '/sdui',
    component: Layout,
    redirect: '/sdui/apps',
    name: 'Sdui',
    meta: {
      title: 'SDUI 管理',
      icon: 'component',
      roles: ['admin', 'editor', 'guest']
    },
    children: [
      {
        path: 'apps',
        name: 'SduiApps',
        component: () => import('@/views/sdui/apps.vue'),
        meta: { title: '应用管理', icon: 'list', roles: ['admin', 'editor', 'guest'] }
      },
      {
        path: 'devices',
        name: 'SduiDevices',
        component: () => import('@/views/sdui/devices.vue'),
        meta: { title: '设备管理', icon: 'list', roles: ['admin', 'editor', 'guest'] }
      },
      {
        path: 'assets',
        name: 'SduiAssets',
        component: () => import('@/views/sdui/assets.vue'),
        meta: { title: '资源管理', icon: 'list', roles: ['admin', 'editor', 'guest'] }
      },
      {
        path: 'runtime',
        name: 'SduiRuntime',
        component: () => import('@/views/sdui/runtime.vue'),
        meta: { title: '运行时监控', icon: 'list', roles: ['admin', 'editor', 'guest'] }
      }
    ]
  },
  {
    path: '/file-ops',
    component: Layout,
    redirect: '/file-ops/manager',
    name: 'FileOps',
    meta: { title: '文件管理', icon: 'documentation', roles: ['editor', 'guest'] },
    children: [
      {
        path: 'manager',
        name: 'FileManager',
        component: () => import('@/views/file-manager/index.vue'),
        meta: { title: '文件列表', icon: 'documentation', roles: ['editor', 'guest'] }
      }
    ]
  },
  {
    path: '/domain-docs',
    component: Layout,
    redirect: '/domain-docs/list',
    name: 'DomainDocs',
    meta: {
      title: '领域文档管理',
      icon: 'documentation',
      roles: ['editor', 'guest']
    },
    children: [
      {
        path: 'list',
        component: () => import('@/views/domain-docs/index.vue'),
        name: 'DomainDocList',
        meta: { title: '领域文档', icon: 'list', noCache: true, roles: ['editor', 'guest'] }
      }
    ]
  },
  {
    path: '/knowledge',
    component: Layout,
    redirect: '/knowledge/list',
    name: 'KnowledgeBase',
    meta: {
      title: '知识库管理',
      icon: 'documentation',
      roles: ['editor', 'guest']
    },
    children: [
      {
        path: 'list',
        component: () => import('@/views/knowledge/index.vue'),
        name: 'DocumentList',
        meta: { title: '向量库', icon: 'list', roles: ['editor', 'guest'] }
      }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/404', meta: { hidden: true }}
];

const createTheRouter = (): Router => createRouter({
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
