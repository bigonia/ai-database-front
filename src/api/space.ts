import request from '@/utils/request'

// 这里的类型定义仅作参考，您可以根据实际 ApiResponse 调整
interface SpaceData {
  name: string
  description?: string
}

export function getSpaces() {
  return request({
    url: '/api/spaces/all',
    method: 'get'
  })
}

export function createSpace(data: SpaceData) {
  return request({
    url: '/api/spaces',
    method: 'post',
    data
  })
}

export function deleteSpace(id: string) {
  return request({
    url: `/api/spaces/${id}`,
    method: 'delete'
  })
}