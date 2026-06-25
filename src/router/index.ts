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
      // ── Node Workflow 新路由 ──
      {
        path: 'node-workflows',
        name: 'SduiNodeWorkflows',
        component: () => import('@/views/sdui/workflow/WorkflowLibrary.vue'),
        meta: { title: '节点工作流', icon: 'share', roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'node-workflows/editor',
        name: 'SduiNodeWorkflowEditor',
        component: () => import('@/views/sdui/workflow/WorkflowEditor.vue'),
        meta: { title: '工作流编辑器', hidden: true, roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'node-workflows/runs',
        name: 'SduiWorkflowRuns',
        component: () => import('@/views/sdui/workflow/RunHistory.vue'),
        meta: { title: '运行记录', hidden: true, roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'node-workflows/:workflowId/runs/:runId',
        name: 'SduiWorkflowRunDetail',
        component: () => import('@/views/sdui/workflow/RunDetail.vue'),
        meta: { title: '运行详情', hidden: true, roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'node-workflows/:workflowId/deployments',
        name: 'SduiWorkflowDeployments',
        component: () => import('@/views/sdui/workflow/DeploymentManagement.vue'),
        meta: { title: '部署管理', hidden: true, roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'node-workflows/:workflowId/deployments/:deploymentId',
        name: 'SduiWorkflowDeploymentDetail',
        component: () => import('@/views/sdui/workflow/DeploymentDetail.vue'),
        meta: { title: '部署详情', hidden: true, roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'ui-templates',
        name: 'SduiUiTemplates',
        component: () => import('@/views/sdui/template/UiTemplateLibrary.vue'),
        meta: { title: 'UI 模板', icon: 'form', roles: ['admin', 'editor', 'guest', 'sdui_only'] }
      },
      {
        path: 'ui-templates/editor',
        name: 'SduiUiTemplateEditor',
        component: () => import('@/views/sdui/template/UiTemplateEditor.vue'),
        meta: { title: '模板编辑器', hidden: true, roles: ['admin', 'editor', 'guest', 'sdui_only'] }
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
