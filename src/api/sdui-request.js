import request from '@/utils/request';

const DEFAULT_TIMEOUT = 30000;

/**
 * Sends a request to the SDUI API with the shared timeout and silent business-error policy.
 * @param {import('axios').AxiosRequestConfig} config
 * @param {{ timeout?: number }} [options]
 */
export default function sduiRequest(config, { timeout = DEFAULT_TIMEOUT } = {}) {
  return request({
    ...config,
    timeout,
    sdui: { silentBusinessError: true }
  });
}
