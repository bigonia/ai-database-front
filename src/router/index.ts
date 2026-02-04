import { markRaw } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router'; // createWebHashHistory, createWebHistory
import type { Router, RouteRecordRaw, RouteComponent } from 'vue-router';
import { Help as IconHelp } from '@element-plus/icons-vue';

/* Layout */
const Layout = (): RouteComponent => import('@/layout/index.vue');

/* Router Modules */
import componentsRouter from './modules/components';
import chartsRouter from './modules/charts';
import nestedRouter from './modules/nested';
import tableRouter from './modules/table';

/**
 * constantRoutes
 * a base page that does not have permission requirements
 * all roles can be accessed
 *
 * 注意：hidden、alwaysShow 属性配置移动到了meta中！！！
 */
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
  // {
  //   path: '/documentation',
  //   component: Layout,
  //   children: [
  //     {
  //       path: 'index',
  //       component: () => import('@/views/documentation/index.vue'),
  //       name: 'Documentation',
  //       meta: { title: '文档', icon: 'documentation', affix: true }
  //     }
  //   ]
  // },
  // {
  //   path: '/guide',
  //   component: Layout,
  //   redirect: '/guide/index',
  //   children: [
  //     {
  //       path: 'index',
  //       component: () => import('@/views/guide/index.vue'),
  //       name: 'Guide',
  //       meta: { title: '引导页', icon: 'guide', noCache: true }
  //     }
  //   ]
  // },
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

/**
 * asyncRoutes
 * the routes that need to be dynamically loaded based on user roles
 *
 * 注意：hidden、alwaysShow 属性配置移动到了meta中！！！
 */
export const asyncRoutes: RouteRecordRaw[] = [
  {
    path: '/permission',
    component: Layout,
    redirect: '/permission/page',
    name: 'Permission',
    meta: {
      alwaysShow: true, // will always show the root menu
      title: '权限测试页',
      icon: 'lock',
      roles: ['admin', 'editor'] // you can set roles in root nav
    },
    children: [
      {
        path: 'page',
        component: () => import('@/views/permission/page.vue'),
        name: 'PagePermission',
        meta: {
          title: '页面权限',
          roles: ['admin'] // or you can only set roles in sub nav
        }
      },
      {
        path: 'directive',
        component: () => import('@/views/permission/directive.vue'),
        name: 'DirectivePermission',
        meta: {
          title: '指令权限'
          // if do not set roles, means: this page does not require permission
        }
      },
      {
        path: 'role',
        component: () => import('@/views/permission/role.vue'),
        name: 'RolePermission',
        meta: {
          title: '角色权限',
          roles: ['admin']
        }
      }
    ]
  },

  {
    path: '/icon',
    component: Layout,
    meta: { roles: ['admin', 'editor'] },
    children: [
      {
        path: 'index',
        component: () => import('@/views/icons/index.vue'),
        name: 'Icons',
        meta: { title: '图标', icon: 'icon', noCache: true, roles: ['admin', 'editor'] }
      }
    ]
  },

  {
    path: '/agent',
    component: Layout, // 假设 Layout 是你的主布局组件
    // redirect: '/agent/list',
    // name: 'AgentManager',
    meta: {
      title: 'Agent 管理',
      icon: 'component', // 替换为你项目中的图标
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
    meta: {
      // title: 'AI 对话',
      // icon: 'el-icon-chat-dot-round',
      roles: ['guest']
    },
    children: [
      {
        path: 'index',
        name: 'AiChat',
        component: () => import('@/views/ai-chat/index.vue'),
        meta: {
          title: 'AI 对话',
          icon: 'wechat',
          // 关键：在这里设置哪些角色可以看到这个页面
          roles: ['admin', 'editor', 'guest']
        }
      }
    ]
  },

  {
    path: '/datasource',
    component: Layout, // 必须是 Layout 组件
    redirect: '/datasource/list',
    name: 'Datasource', // 路由名称
    meta: {
      title: '数据源管理', // 侧边栏显示的标题
      icon: 'table', // 侧边栏图标 (el-icon-coin, database, table 等)
      roles: ['admin', 'editor', 'guest']
    },
    children: [
      {
        path: 'list',
        name: 'DatasourceList',
        component: () => import('@/views/datasource/index.vue'), // 指向我们刚创建的 .vue 文件
        meta: { title: '数据源列表', icon: 'table', roles: ['editor', 'guest'] } // 子菜单标题和图标
      }
      // 如果您有 "新建数据源" 的单独页面，可以在这里添加
      // {
      //   path: 'create',
      //   name: 'DatasourceCreate',
      //   component: () => import('@/views/datasource/create'),
      //   meta: { title: '新增数据源', icon: 'edit' },
      //   hidden: true // 不在侧边栏显示，但可以跳转
      // }
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
        component: () => import('@/views/file-manager/index.vue'), // 指向您刚创建的文件
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
      icon: 'documentation', roles: ['editor', 'guest']
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
      icon: 'documentation' // 确保您有这个icon，或者换成 'table'
      , roles: ['editor', 'guest']
    },
    children: [
      {
        path: 'list',
        component: () => import('@/views/knowledge/index'),
        name: 'DocumentList',
        meta: { title: '向量库', icon: 'list', roles: ['editor', 'guest'] }
      }
    ]
  },

  // /** when your routing map is too long, you can split it into small modules **/
  componentsRouter,
  chartsRouter,
  nestedRouter,
  tableRouter,

  {
    path: '/example',
    component: Layout,
    redirect: '/example/list',
    name: 'Example',
    meta: {
      title: '综合示例',
      icon: markRaw(IconHelp),
      meta: { title: '综合示例', icon: 'example', roles: ['guest', 'admin'] }
    },
    children: [
      {
        path: 'create',
        component: () => import('@/views/example/create.vue'),
        name: 'CreateArticle',
        meta: { title: '创建文章', icon: 'edit' }
      },
      {
        path: 'edit/:id(\\d+)',
        component: () => import('@/views/example/edit.vue'),
        name: 'EditArticle',
        meta: { hidden: true, title: '编辑文章', noCache: true, activeMenu: '/example/list' }
      },
      {
        path: 'list',
        component: () => import('@/views/example/list.vue'),
        name: 'ArticleList',
        meta: { title: '文章列表', icon: 'list' }
      }
    ]
  },

  {
    path: '/tab',
    component: Layout,
    children: [
      {
        path: 'index',
        component: () => import('@/views/tab/index.vue'),
        name: 'Tab',
        meta: { title: 'Tabs标签页', icon: 'tab' }
      }
    ]
  },

  {
    path: '/error',
    component: Layout,
    redirect: 'noRedirect',
    name: 'ErrorPages',
    meta: {
      title: '错误页面',
      icon: '404'
    },
    children: [
      {
        path: '401',
        component: () => import('@/views/error-page/401.vue'),
        name: 'Page401',
        meta: { title: '401', noCache: true }
      },
      {
        path: '404',
        component: () => import('@/views/error-page/404.vue'),
        name: 'Page404',
        meta: { title: '404', noCache: true }
      }
    ]
  },

  {
    path: '/error-log',
    component: Layout,
    children: [
      {
        path: 'log',
        component: () => import('@/views/error-log/index.vue'),
        name: 'ErrorLog',
        meta: { title: '错误日志', icon: 'bug' }
      }
    ]
  },

  {
    path: '/excel',
    component: Layout,
    redirect: '/excel/export-excel',
    name: 'Excel',
    meta: {
      title: 'Excel',
      icon: 'excel'
    },
    children: [
      {
        path: 'export-excel',
        component: () => import('@/views/excel/export-excel.vue'),
        name: 'ExportExcel',
        meta: { title: '导出 Excel' }
      },
      {
        path: 'export-selected-excel',
        component: () => import('@/views/excel/select-excel.vue'),
        name: 'SelectExcel',
        meta: { title: '导出 已选择项' }
      },
      {
        path: 'export-merge-header',
        component: () => import('@/views/excel/merge-header.vue'),
        name: 'MergeHeader',
        meta: { title: '导出 多级表头' }
      },
      {
        path: 'upload-excel',
        component: () => import('@/views/excel/upload-excel.vue'),
        name: 'UploadExcel',
        meta: { title: '上传 Excel' }
      }
    ]
  },

  {
    path: '/zip',
    component: Layout,
    redirect: '/zip/download',
    name: 'Zip',
    meta: { alwaysShow: true, title: 'Zip', icon: 'zip' },
    children: [
      {
        path: 'download',
        component: () => import('@/views/zip/index.vue'),
        name: 'ExportZip',
        meta: { title: '导出 Zip' }
      }
    ]
  },

  {
    path: '/pdf',
    component: Layout,
    redirect: '/pdf/index',
    children: [
      {
        path: 'index',
        component: () => import('@/views/pdf/index.vue'),
        name: 'PDF',
        meta: { title: 'PDF', icon: 'pdf' }
      }
    ]
  },
  {
    path: '/pdf/download',
    component: () => import('@/views/pdf/download.vue'),
    meta: { hidden: true }
  },

  {
    path: '/theme',
    component: Layout,
    children: [
      {
        path: 'index',
        component: () => import('@/views/theme/index.vue'),
        name: 'Theme',
        meta: { title: '主题', icon: 'theme' }
      }
    ]
  },

  {
    path: '/clipboard',
    component: Layout,
    children: [
      {
        path: 'index',
        component: () => import('@/views/clipboard/index.vue'),
        name: 'ClipboardDemo',
        meta: { title: '剪贴板', icon: 'clipboard' }
      }
    ]
  },

  {
    path: '/external-link',
    component: Layout,
    children: [
      {
        path: 'https://element-plus.midfar.com',
        meta: { title: '外链', icon: 'link' },
        redirect: ''
      }
    ]
  },

  {
    path: '/my-demo',
    component: Layout,
    name: 'MyDemo',
    meta: {
      title: '我的示例',
      icon: 'component'
    },
    children: [
      {
        path: 'element-demo',
        component: () => import('@/views/mydemo/ElementDemo.vue'),
        name: 'ElementDemo',
        meta: { title: 'Element 示例', icon: 'skill' }
      },
      {
        path: 'store-demo',
        component: () => import('@/views/mydemo/StoreDemo.vue'),
        name: 'StoreDemo',
        meta: { title: 'Store 示例', icon: 'lock' }
      }
    ]
  },

  // 404 page must be placed at the end !!!
  { path: '/:pathMatch(.*)*', redirect: '/404', meta: { hidden: true } }
];

console.log('BASE_URL=', import.meta.env);

const createTheRouter = (): Router => createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  // 注意，如果要配置 HTML5 模式，则需要修改nginx配置，参考资料：
  // https://router.vuejs.org/zh/guide/essentials/history-mode.html
  // history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: constantRoutes
});

interface RouterPro extends Router {
  matcher: unknown;
}

const router = createTheRouter() as RouterPro;

// Detail see: https://github.com/vuejs/vue-router/issues/1234#issuecomment-357941465
export function resetRouter() {
  // router.clearRoutes(); RangeError: Maximum call stack size exceeded
  const newRouter = createTheRouter() as RouterPro;
  router.matcher = newRouter.matcher; // reset router
}

export default router;
