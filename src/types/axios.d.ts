import 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    sdui?: {
      silentBusinessError?: boolean;
      silentHttpError?: boolean;
    };
  }

  interface InternalAxiosRequestConfig {
    sdui?: {
      silentBusinessError?: boolean;
      silentHttpError?: boolean;
    };
  }
}
