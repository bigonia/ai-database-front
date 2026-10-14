import axios from 'axios';
import { getToken } from '@/utils/auth';
import userStore from '@/store/modules/user';

/** @typedef {{ code: number, message?: string, data?: unknown }} ApiEnvelope */

// create an axios instance
const service = axios.create({
  baseURL: import.meta.env.VITE_BASE_API, // url = base url + request url
  // withCredentials: true, // send cookies when cross-domain requests
  timeout: 5000 // request timeout
});

export class ApiBusinessError extends Error {
  /**
   * @param {ApiEnvelope} response
   * @param {import('axios').InternalAxiosRequestConfig} config
   */
  constructor(response, config) {
    super(response?.message || '请求被服务端拒绝');
    this.name = 'ApiBusinessError';
    this.code = response?.code;
    this.data = response?.data;
    this.apiResponse = response;
    this.config = config;
  }
}

export function handleRequestError(error, { notify = true } = {}) {
  const status = error.response?.status;
  const currentPath = window.location.hash.slice(1).split('?')[0];
  if (status === 401 && currentPath !== '/login') {
    userStore().resetToken();
    const redirect = window.location.hash.slice(1) || '/';
    window.location.hash = `/login?redirect=${encodeURIComponent(redirect)}`;
  } else if (status === 403 && currentPath !== '/401') {
    window.location.hash = '/401';
  }
  if (notify && status !== 401 && status !== 403) {
    ElMessage({
      message: error.response?.data?.message || error.message,
      type: 'error',
      duration: 5 * 1000
    });
  }
}

// request interceptor
service.interceptors.request.use(
  config => {
    // do something before request is sent
    const token = getToken();
    if (token) {
      // let each request carry token
      config.headers['Authorization'] = 'Bearer ' + token;
    }

    return config;
  },
  error => {
    // do something with request error
    console.log(error); // for debug
    return Promise.reject(error);
  }
);

// response interceptor
service.interceptors.response.use(
  /**
   * If you want to get http information such as headers or status
   * Please return  response => response
  */
  response => {
    /** @type {ApiEnvelope} */
    const res = response.data;

    // 检查：如果 API 直接返回了一个数组
    // if (Array.isArray(response.data) || res.code == null) {
    //   return {
    //     code: 20000,
    //     data: response.data // 修改：这里不需要再包一层 data.items，除非你的UI组件强制要求
    //     // 如果后端返回的就是 List<BusinessSpace>，那么 res 就是数组
    //   };
    // }
    // 如果是下载文件，直接返回完整的 response 对象（包含 headers, data 等）
    if (
      response.config.responseType === 'blob' ||
      response.headers['content-type']?.includes('application/octet-stream') ||
      response.headers['content-type']?.includes('application/vnd.openxmlformats')
    ) {
      return response;
    }

    // if the custom code is not 20000, it is judged as an error.
    if (res.code !== 20000) {
      // 1. 检查是否是二进制流
      if (response.config.responseType === 'blob' || response.data instanceof Blob) {
        return response.data; // 直接返回 Blob，不检查 code
      }

      if (res.code === 50008 || res.code === 50012 || res.code === 50014) {
        ElMessageBox.confirm('You have been logged out, you can cancel to stay on this page, or log in again', 'Confirm logout', {
          confirmButtonText: 'Re-Login',
          cancelButtonText: 'Cancel',
          type: 'warning'
        }).then(() => {
          userStore().resetToken();
          location.reload();
        });
      }
      const error = new ApiBusinessError(res, response.config);
      if (!response.config.sdui?.silentBusinessError) {
        ElMessage({ message: error.message, type: 'error', duration: 5 * 1000 });
      }
      return Promise.reject(error);
    } else {
      return res;
    }
  },
  error => {
    handleRequestError(error, { notify: !error.config?.sdui?.silentHttpError });
    return Promise.reject(error);
  }
);

export default service;
