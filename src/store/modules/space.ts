import { defineStore } from 'pinia'
import { getSpaces } from '@/api/space'

export const useSpaceStore = defineStore('space', {
  state: () => ({
    currentSpaceId: localStorage.getItem('space_id') || '',
    spaces: [] as any[] // 存储空间列表
  }),
  getters: {
    // 获取当前选中的空间对象，用于回显名称
    currentSpace: (state) => state.spaces.find(s => s.id === state.currentSpaceId)
  },
  actions: {
    // 加载空间列表
    async loadSpaces() {
      try {
        const res: any = await getSpaces()
        // 根据您的 request.js 封装，这里直接取 data
        // 如果后端返回 ApiResponse<List>，数据通常在 res.data 中
        const list = res.data || []
        this.spaces = list

        // 初始化逻辑：如果本地没有存ID，或存的ID不在列表中，默认选中第一个
        if (this.spaces.length > 0) {
          const exists = this.spaces.find(s => s.id === this.currentSpaceId)
          if (!this.currentSpaceId || !exists) {
            this.setSpace(this.spaces[0].id)
          }
        } else {
          // 如果没有任何空间，清空ID
          this.currentSpaceId = ''
          localStorage.removeItem('space_id')
        }
      } catch (error) {
        console.error('Load spaces failed', error)
      }
    },
    // 切换空间
    setSpace(id: string) {
      this.currentSpaceId = id
      localStorage.setItem('space_id', id)
    }
  }
})

export default useSpaceStore