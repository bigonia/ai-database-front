import { defineStore } from 'pinia';
import { login as apiLogin, logout as apiLogout, getInfo as apiGetInfo } from '@/api/user';
import { getToken, setToken, removeToken } from '@/utils/auth';
import { resetRouter } from '@/router';
import tagsViewStore from './tagsView';
import permissionStore from './permission';
import { clearUserSession, isUserSessionCurrent, readUserInfoForSession } from '../sessionLifecycle';

export interface IUserState {
  token: string;
  userId: string,
  name: string;
  avatar: string;
  introduction: string;
  roles: string[];
  sessionGeneration: number;
}

let infoRequest: { token: string; generation: number; promise: Promise<Record<string, unknown>> } | undefined;

export default defineStore({
  id: 'user',
  state: ():IUserState => ({
    token: getToken(),
    userId: '',
    name: '',
    avatar: '',
    introduction: '',
    roles: [],
    sessionGeneration: 0
  }),
  getters: {},
  actions: {
    // user login
    login(userInfo):Promise<void> {
      const { username, password } = userInfo;
      return new Promise((resolve, reject) => {
        apiLogin({ username: username.trim(), password: password }).then(response => {
          const { data } = response;
          this.resetToken();
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
      const token = this.token;
      const generation = this.sessionGeneration;
      if (infoRequest?.token === token && infoRequest.generation === generation) return infoRequest.promise;
      const promise = readUserInfoForSession({
        state: this,
        token,
        generation,
        read: async () => (await apiGetInfo()).data,
        apply: value => {
          if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new Error('用户信息响应格式无效，请重新登录');
          }
          const data = value as Record<string, unknown>;
          const { roles, name, avatar, introduction } = data;
          if (!Array.isArray(roles) || roles.length === 0 ||
            !roles.every(role => typeof role === 'string' && role.trim().length > 0)) {
            throw new Error('用户角色信息无效，请重新登录');
          }
          this.roles = [...new Set(roles.map(role => (role as string).trim()))];
          this.userId = typeof data.userId === 'string' ? data.userId : '';
          this.name = typeof name === 'string' ? name : '';
          this.avatar = typeof avatar === 'string' ? avatar : '';
          this.introduction = typeof introduction === 'string' ? introduction : '';
          return { ...data, roles: this.roles };
        }
      }).then(result => {
        if (result.kind === 'stale') throw new Error('登录状态已切换，请重试当前操作');
        return result.value;
      }).finally(() => {
        if (infoRequest?.generation === generation && infoRequest.token === token) infoRequest = undefined;
      });
      infoRequest = { token, generation, promise };
      return promise;
    },

    // user logout
    async logout():Promise<void> {
      try {
        await apiLogout();
      } finally {
        this.resetToken();
      }
    },

    // remove token
    resetToken() {
      clearUserSession(this, {
        removeToken,
        resetRouter,
        clearPermissionRoutes: () => permissionStore().setRoutes([]),
        clearCachedViews: () => tagsViewStore().delAllViews()
      });
    },

    isSessionCurrent(token: string, generation: number) {
      return isUserSessionCurrent(this, token, generation);
    }
  }
});
