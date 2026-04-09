import request from '@/utils/request';

const BASE_URL = '/api/v1/sdui';

export function generateApp(data) {
  return request({
    url: `${BASE_URL}/apps/generate`,
    method: 'post',
    data
  });
}

export function reviseApp(appId, data) {
  return request({
    url: `${BASE_URL}/apps/${appId}/revise`,
    method: 'post',
    data
  });
}

export function getAppList() {
  return request({
    url: `${BASE_URL}/apps`,
    method: 'get'
  });
}

export function getAppVersions(appId) {
  return request({
    url: `${BASE_URL}/apps/${appId}/versions`,
    method: 'get'
  });
}

export function publishApp(appId, data) {
  return request({
    url: `${BASE_URL}/apps/${appId}/publish`,
    method: 'post',
    data
  });
}

export function getDeviceList() {
  return request({
    url: `${BASE_URL}/devices`,
    method: 'get'
  });
}

export function getUnclaimedDeviceList() {
  return request({
    url: `${BASE_URL}/devices/unclaimed`,
    method: 'get'
  });
}

export function claimDevice(deviceId, data) {
  return request({
    url: `${BASE_URL}/devices/${deviceId}/claim`,
    method: 'post',
    data
  });
}

export function getDeviceTelemetry(deviceId) {
  return request({
    url: `${BASE_URL}/devices/${deviceId}/telemetry`,
    method: 'get'
  });
}

export function controlDevice(deviceId, data) {
  return request({
    url: `${BASE_URL}/devices/${deviceId}/control`,
    method: 'post',
    data
  });
}

export function getRuntimeWorkers() {
  return request({
    url: `${BASE_URL}/runtime/workers`,
    method: 'get'
  });
}

export function getOpsOverview() {
  return request({
    url: `${BASE_URL}/ops/overview`,
    method: 'get'
  });
}

export function registerAsset(data) {
  return request({
    url: `${BASE_URL}/assets`,
    method: 'post',
    data
  });
}

export function getAssetList(params) {
  return request({
    url: `${BASE_URL}/assets`,
    method: 'get',
    params
  });
}

export function getAssetSourceFiles(params) {
  return request({
    url: `${BASE_URL}/assets/source-files`,
    method: 'get',
    params
  });
}

export function bindAppAsset(appId, data) {
  return request({
    url: `${BASE_URL}/apps/${appId}/assets:bind`,
    method: 'post',
    data
  });
}

export function getAppAssets(appId) {
  return request({
    url: `${BASE_URL}/apps/${appId}/assets`,
    method: 'get'
  });
}

export function unbindAppAsset(appId, bindingId) {
  return request({
    url: `${BASE_URL}/apps/${appId}/assets/${bindingId}`,
    method: 'delete'
  });
}

export function createAssetSet(data) {
  return request({
    url: `${BASE_URL}/asset-sets`,
    method: 'post',
    data
  });
}

export function getAssetSetList(params) {
  return request({
    url: `${BASE_URL}/asset-sets`,
    method: 'get',
    params
  });
}

export function addAssetSetItems(assetSetId, data) {
  return request({
    url: `${BASE_URL}/asset-sets/${assetSetId}/items`,
    method: 'post',
    data
  });
}

export function getAssetSetItems(assetSetId) {
  return request({
    url: `${BASE_URL}/asset-sets/${assetSetId}/items`,
    method: 'get'
  });
}

export function removeAssetSetItem(assetSetId, itemId) {
  return request({
    url: `${BASE_URL}/asset-sets/${assetSetId}/items/${itemId}`,
    method: 'delete'
  });
}
