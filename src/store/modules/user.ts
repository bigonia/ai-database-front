import { defineStore } from 'pinia';
import { login as apiLogin, logout as apiLogout, getInfo as apiGetInfo } from '@/api/user';
import { getToken, setToken, removeToken } from '@/utils/auth';
import router, { resetRouter } from '@/router';
import tagsViewStore from './tagsView';
import permissionStore from './permission';

export interface IUserState {
  token: string;
  userId: string,
  name: string;
  avatar: string;
  introduction: string;
  roles: string[];
}

export default defineStore({
  id: 'user',
  state: ():IUserState => ({
    token: getToken(),
    userId: '',
    name: '',
    avatar: '',
    introduction: '',
    roles: []
  }),
  getters: {},
  actions: {
    // user login
    login(userInfo):Promise<void> {
      const { username, password } = userInfo;
      return new Promise((resolve, reject) => {
        apiLogin({ username: username.trim(), password: password }).then(response => {
          const { data } = response;
          this.token = data.token;
          setToken(data.token);
          resolve();
        }).catch(error => {
          reject(error);
        });
      });
    },

    // get user info
    getInfo() {
      return new Promise((resolve, reject) => {
        apiGetInfo(this.token).then(response => {
          const { data } = response;

          if (!data || typeof data !== 'object' || Array.isArray(data)) {
            reject(new Error('用户信息响应格式无效，请重新登录'));
            return;
          }

          const { roles, name, avatar, introduction } = data;
          if (!Array.isArray(roles) || roles.length === 0
            || !roles.every(role => typeof role === 'string' && role.trim().length > 0)) {
            reject(new Error('用户角色信息无效，请重新登录'));
            return;
          }

          this.roles = [...new Set(roles.map(role => role.trim()))];
          this.name = typeof name === 'string' ? name : '';
          this.avatar = typeof avatar === 'string' ? avatar : '';
          this.introduction = typeof introduction === 'string' ? introduction : '';
          resolve({ ...data, roles: this.roles });
        }).catch(error => {
          reject(error);
        });
      });
    },

    // user logout
    logout():Promise<void> {
      return new Promise((resolve, reject) => {
        apiLogout(this.token).then(() => {
          this.token = '';
          this.roles = [];
          removeToken();
          resetRouter();
          permissionStore().setRoutes([]);

          // reset visited views and cached views
          // to fixed https://github.com/PanJiaChen/vue-element-admin/issues/2485
          tagsViewStore().delAllViews();

          resolve();
        }).catch(error => {
          reject(error);
        });
      });
    },

    // remove token
    resetToken() {
      this.token = '';
      this.roles = [];
      removeToken();
      resetRouter();
      permissionStore().setRoutes([]);
      tagsViewStore().delAllViews();
    },

    // dynamically modify permissions
    async changeRoles(role) {
      const token = role + '-token';

      this.token = token;
      setToken(token);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const infoRes = await this.getInfo() as any;
      let roles = [];
      if (infoRes.roles) {
        roles = infoRes.roles;
      }

      resetRouter();

      // generate accessible routes map based on roles
      const accessRoutes = await permissionStore().generateRoutes(roles);
      // dynamically add accessible routes
      // router.addRoutes(accessRoutes);
      accessRoutes.forEach(item => {
        router.addRoute(item);
      });

      // reset visited views and cached views
      tagsViewStore().delAllViews();
    }
  }
});
