<template>
  <div class="ai-chat-layout">
    <!-- 侧边栏 - 对话历史 -->
    <div class="sidebar" :class="{ 'sidebar-collapsed': !sidebarVisible }">
      <div class="sidebar-header">
        <h3>对话列表</h3>
        <!-- 图标变量 Plus 已在 setup 中导出 -->
        <el-button type="primary" :icon="Plus" circle @click="handleCreateChat" title="新建对话" />
      </div>
      <div class="sidebar-content" v-loading="isListLoading">
        <div
          v-for="chat in chatHistory"
          :key="chat.id"
          class="chat-card"
          :class="{ 'active': currentChatId === chat.id }"
          @click="switchChat(chat.id)"
        >
          <div class="chat-card-inner">
            <div class="chat-main">
              <span class="chat-title" :title="chat.title">{{ chat.title || '无标题会话' }}</span>
              <span class="chat-time">{{ formatTime(chat.updatedAt || chat.createdAt) }}</span>
            </div>
            <!-- 更多操作按钮 -->
            <div class="chat-options">
               <el-dropdown @command="handleChatCommand" trigger="click">
                <el-icon class="option-icon" @click.stop><MoreFilled /></el-icon>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :command="{action: 'rename', id: chat.id, title: chat.title}">重命名</el-dropdown-item>
                    <el-dropdown-item :command="{action: 'delete', id: chat.id}" divided>删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </div>
        
        <!-- 列表为空时的展示 -->
        <div v-if="!isListLoading && chatHistory.length === 0" class="empty-history">
          <el-empty description="暂无历史对话" :image-size="60"></el-empty>
        </div>
      </div>
    </div>

    <!-- 主对话区域 -->
    <div class="main-content">
      <!-- 顶部工具栏 -->
      <div class="chat-header">
        <div class="header-left">
          <el-button link :icon="sidebarVisible ? Fold : Expand" @click="toggleSidebar" class="toggle-btn" />
          <h3>{{ currentChatTitle || '新对话' }}</h3>
        </div>
      </div>

      <!-- 消息展示区域 -->
      <div ref="messageContainer" class="message-container" v-loading="isMessageLoading">
        <!-- 空状态：欢迎页 (当没有ID或者有ID但没消息时显示) -->
        <div v-if="(!currentChatId || currentMessages.length === 0) && !isMessageLoading" class="welcome-screen">
          <div class="welcome-content">
            <el-icon class="welcome-icon"><Promotion /></el-icon>
            <h2>你好，我是 AI 助手</h2>
            <p>我可以帮你解答问题、编写代码、分析文档。</p>
            <div class="suggestion-chips">
              <span class="chip" @click="quickAsk('帮我写一个工作周报')">📝 帮我写一个工作周报</span>
              <span class="chip" @click="quickAsk('解释一下量子纠缠')">🔬 解释一下量子纠缠</span>
              <span class="chip" @click="quickAsk('Python 读取 Excel 示例')">🐍 Python 读取 Excel</span>
            </div>
          </div>
        </div>
        
        <!-- 消息列表 -->
        <div v-else class="chat-list">
           <div v-for="(message, index) in currentMessages" :key="index" :class="['message-row', message.sender]">
            <!-- 头像 -->
            <div class="avatar-wrapper">
              <div v-if="message.sender === 'user'" class="avatar user-avatar">
                <el-icon><UserFilled /></el-icon>
              </div>
              <div v-else class="avatar ai-avatar">
                <el-icon><Promotion /></el-icon>
              </div>
            </div>

            <!-- 消息内容 -->
            <div class="message-content-wrapper">
              
              <!-- 消息气泡 -->
              <div class="message-bubble">
                <div v-if="message.sender === 'ai'" class="markdown-body" v-html="renderMarkdown(message.text)" />
                <div v-else class="user-text">{{ message.text }}</div>
              </div>

              <!-- AI消息的底部功能区 -->
              <div v-if="message.sender === 'ai'" class="ai-message-extras">
                
                <!-- 优化后的引用文档展示 (仿工具调用效果) -->
                <div v-if="message.context && message.context.length > 0" class="reference-accordion">
                  <div class="reference-header" @click="toggleReference(index)">
                    <div class="ref-header-left">
                      <el-icon class="ref-icon"><Collection /></el-icon>
                      <span class="ref-title">已参考 {{ message.context.length }} 个来源</span>
                    </div>
                    <el-icon class="arrow-icon" :class="{ 'is-active': message.isRefExpanded }"><ArrowDown /></el-icon>
                  </div>
                  
                  <div v-show="message.isRefExpanded" class="reference-body">
                    <div v-for="(doc, docIndex) in message.context" :key="docIndex" class="reference-item">
                      <div class="ref-item-header">
                        <span class="ref-item-idx">{{ docIndex + 1 }}</span>
                        <!-- 修改点：使用 doc.metadata?.originalFilename -->
                        <span class="ref-item-title">{{ doc.metadata?.originalFilename || doc.metadata?.sourceName || '未知文档' }}</span>
                        <el-button link size="small" class="copy-btn" @click.stop="copyText(doc.text)">
                          <el-icon><CopyDocument /></el-icon>
                        </el-button>
                      </div>
                      <div class="ref-item-content">
                        {{ truncateText(doc.text, 80) }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 底部操作按钮 -->
                <div class="message-actions" v-if="message.text">
                  <el-tooltip content="复制内容" placement="top" :show-after="500">
                    <div class="action-btn" @click="copyText(message.text)">
                      <el-icon><CopyDocument /></el-icon>
                    </div>
                  </el-tooltip>
                </div>
              </div>

              <!-- AI 正在输入时的打字机动画 -->
              <div v-if="message.sender === 'ai' && isStreamLoading && index === currentMessages.length - 1" class="typing-indicator">
                <span class="dot"></span><span class="dot"></span><span class="dot"></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部输入区域 -->
      <div class="input-wrapper">
        <div class="input-box">
          <el-input
            v-model="userInput"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 8 }"
            placeholder="输入您的问题，按 Enter 发送，Shift + Enter 换行..."
            :disabled="isStreamLoading"
            class="custom-textarea"
            @keydown.enter.exact.prevent="sendMessage"
            @keydown.enter.shift.exact.prevent="userInput += '\n'"
          />
          <div class="send-btn-wrapper">
             <el-button
              type="primary"
              :icon="Promotion"
              circle
              :loading="isStreamLoading"
              :disabled="!userInput.trim() || isStreamLoading"
              @click="sendMessage"
            />
          </div>
        </div>
        <div class="input-footer-tip">
          内容由 AI 生成，请仔细甄别。
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// 导入 API
import { 
  fetchChatStream, 
  getUserConversations, 
  createConversation, 
  getConversationMessages,
  deleteConversation,
  renameConversation
} from '@/api/chat';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
// 导入图标
import {
  Promotion, UserFilled, Plus, Expand, Fold, MoreFilled, 
  ChatLineRound, Document, CopyDocument, Collection, ArrowDown
} from '@element-plus/icons-vue';
import { ElMessageBox, ElMessage } from 'element-plus';

export default {
  name: 'AiChat',
  components: {
    Promotion, UserFilled, Plus, Expand, Fold, MoreFilled, 
    ChatLineRound, Document, CopyDocument, Collection, ArrowDown
  },
  setup() {
    return {
      Promotion, UserFilled, Plus, Expand, Fold, MoreFilled, 
      ChatLineRound, Document, CopyDocument, Collection, ArrowDown
    };
  },
  data() {
    return {
      sidebarVisible: true,
      userInput: '',
      isStreamLoading: false, // 发送消息流加载中
      isListLoading: false,   // 列表加载中
      isMessageLoading: false,// 消息详情加载中
      // isCreating: false,   // 移除：因为改为懒创建，点击+号不再需要loading状态
      currentChatId: null,
      currentChatTitle: '',
      chatHistory: [],        // 列表数据
      currentMessages: []     // 当前选中的会话消息
    };
  },
  watch: {
    currentMessages: {
      handler() {
        this.$nextTick(() => {
          this.scrollToBottom();
        });
      },
      deep: true
    }
  },
  mounted() {
    this.initChatList();
  },
  methods: {
    toggleSidebar() {
      this.sidebarVisible = !this.sidebarVisible;
    },

    toggleReference(index) {
      const msg = this.currentMessages[index];
      if (msg) {
        msg.isRefExpanded = !msg.isRefExpanded;
      }
    },

    // 快捷提问
    quickAsk(text) {
      this.userInput = text;
      this.sendMessage();
    },

    // 初始化：获取会话列表
    async initChatList() {
      this.isListLoading = true;
      try {
        const res = await getUserConversations();
        let list = [];
        if (Array.isArray(res)) {
          list = res;
        } else if (res && Array.isArray(res.data)) {
          list = res.data;
        } else if (res && res.list && Array.isArray(res.list)) {
            list = res.list;
        } else {
            list = [];
        }

        this.chatHistory = list;
        
        // 默认行为：如果有历史，选中第一个；如果没有，保持当前状态（即新对话状态）
        if (this.chatHistory.length > 0) {
          this.switchChat(this.chatHistory[0].id);
        } else {
          this.handleCreateChat();
        }
      } catch (error) {
        console.error('获取会话列表失败', error);
        this.chatHistory = []; 
        ElMessage.error('无法连接到服务器');
      } finally {
        this.isListLoading = false;
      }
    },

    // 修改为：重置界面，不立即请求后端
    handleCreateChat() {
      // 只有当前已经在某个会话中，才执行重置
      if (this.currentChatId !== null) {
        this.currentChatId = null;
        this.currentMessages = [];
        this.currentChatTitle = '新对话';
        // 聚焦输入框体验更好（需配合ref，此处略）
      }
    },

    // 切换会话
    async switchChat(chatId) {
      if (this.currentChatId === chatId) return;
      
      this.currentChatId = chatId;
      this.userInput = '';
      this.isMessageLoading = true;
      
      const chat = this.chatHistory.find(c => c.id === chatId);
      this.currentChatTitle = chat ? chat.title : '新对话';

      try {
        const res = await getConversationMessages(chatId);
        const backendMessages = Array.isArray(res) ? res : (res.data || []);
        
        this.currentMessages = backendMessages.map(msg => {
          const isUser = msg.role === 'user' || msg.sender === 'user' || msg.messageType === 'USER'; 
          return {
            sender: isUser ? 'user' : 'ai',
            text: msg.content || msg.text || '',
            context: msg.context || [],
            isRefExpanded: false, // 默认收起引用
            timestamp: (msg.createTime || msg.timestamp) ? new Date(msg.createTime || msg.timestamp) : new Date()
          };
        });
      } catch (error) {
        console.error('加载消息失败', error);
        ElMessage.error('加载消息失败');
        this.currentMessages = [];
      } finally {
        this.isMessageLoading = false;
        this.scrollToBottom();
      }
    },

    handleChatCommand(command) {
      const { action, id, title } = command;
      if (action === 'rename') {
        this.renameChat(id, title);
      } else if (action === 'delete') {
        this.deleteChat(id);
      }
    },

    renameChat(chatId, oldTitle) {
      ElMessageBox.prompt('请输入新的对话名称', '重命名', {
        inputValue: oldTitle,
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        inputValidator: (val) => {
            if (!val || !val.trim()) return '名称不能为空';
            return true;
        }
      }).then(async ({ value }) => {
        try {
          await renameConversation(chatId, value);
          const chat = this.chatHistory.find(c => c.id === chatId);
          if (chat) chat.title = value;
          if (this.currentChatId === chatId) this.currentChatTitle = value;
          ElMessage.success('重命名成功');
        } catch (error) {
          ElMessage.error('重命名失败');
        }
      }).catch(() => {});
    },

    deleteChat(chatId) {
      ElMessageBox.confirm('删除后无法恢复，是否确认？', '删除会话', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          await deleteConversation(chatId);
          if (Array.isArray(this.chatHistory)) {
             const index = this.chatHistory.findIndex(c => c.id === chatId);
             if (index !== -1) {
               this.chatHistory.splice(index, 1);
             }
             if (this.currentChatId === chatId) {
               if (this.chatHistory.length > 0) {
                 this.switchChat(this.chatHistory[0].id);
               } else {
                 // 重置为新对话状态
                 this.handleCreateChat();
               }
             }
          }
          ElMessage.success('删除成功');
        } catch (error) {
          ElMessage.error('删除失败');
        }
      }).catch(() => {});
    },

    // 发送消息
    async sendMessage() {
      const query = this.userInput.trim();
      if (!query || this.isStreamLoading) return;

      this.isStreamLoading = true;

      // 逻辑变更：如果当前没有会话ID，说明是新对话，先创建
      if (!this.currentChatId) {
        try {
          // 使用用户输入的前15个字作为标题
          const title = query.length > 15 ? query.substring(0, 15) + '...' : query;
          const res = await createConversation(title);
          const newChat = (res && res.data) ? res.data : res;
          
          if (!newChat || !newChat.id) {
             throw new Error("创建会话失败");
          }

          this.currentChatId = newChat.id;
          this.currentChatTitle = newChat.title;
          
          // 更新左侧列表
          if (!Array.isArray(this.chatHistory)) this.chatHistory = [];
          this.chatHistory.unshift(newChat);

        } catch (e) {
          console.error("自动创建会话失败", e);
          ElMessage.error("创建会话失败，请重试");
          this.isStreamLoading = false;
          return;
        }
      }

      const sessionId = this.currentChatId;

      // 1. 用户消息上屏
      this.currentMessages.push({
        sender: 'user',
        text: query,
        timestamp: new Date()
      });
      this.userInput = '';
      this.scrollToBottom();

      // 2. 预置 AI 消息
      const aiMessage = {
        sender: 'ai',
        text: '',
        context: [],
        isRefExpanded: false,
        timestamp: new Date()
      };
      this.currentMessages.push(aiMessage);
      const aiMessageIndex = this.currentMessages.length - 1;

      // 3. 流式请求
      try {
        await fetchChatStream(
          { query: query, sessionId: sessionId },
          (streamData) => {
            const { type, data } = streamData;
            if (type === 'TEXT') {
               this.currentMessages[aiMessageIndex].text += data;
               this.scrollToBottom();
            } else if (type === 'CONTEXT') {
               this.currentMessages[aiMessageIndex].context = data;
               // 接收到引用文档时，可以考虑自动展开或闪烁提示，目前保持静默
            }
          },
          () => {
            this.isStreamLoading = false;
            // 更新当前会话时间
            if (Array.isArray(this.chatHistory)) {
                const chat = this.chatHistory.find(c => c.id === this.currentChatId);
                if(chat) chat.updatedAt = new Date();
            }
          },
          (error) => {
            this.isStreamLoading = false;
            if (!this.currentMessages[aiMessageIndex].text) {
              this.currentMessages[aiMessageIndex].text = '网络连接异常，请重试。';
            }
            console.error(error);
          }
        );
      } catch (e) {
        this.isStreamLoading = false;
      }
    },

    formatTime(dateStr) {
      if (!dateStr) return '刚刚';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '刚刚';
      const now = new Date();
      const diff = now - date;
      const oneDay = 24 * 60 * 60 * 1000;
      if (diff < oneDay && now.getDate() === date.getDate()) {
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      }
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    },

    renderMarkdown(text) {
      if (!text) return '';
      marked.setOptions({
        renderer: new marked.Renderer(),
        gfm: true,
        breaks: true
      });
      return DOMPurify.sanitize(marked.parse(text));
    },

    truncateText(text, length) {
      if (!text) return '';
      return text.length > length ? text.substring(0, length) + '...' : text;
    },

    copyText(text) {
      navigator.clipboard.writeText(text).then(() => ElMessage.success('已复制'));
    },

    scrollToBottom() {
      this.$nextTick(() => {
        const container = this.$refs.messageContainer;
        if (container) container.scrollTop = container.scrollHeight;
      });
    }
  }
};
</script>

<style scoped>
.ai-chat-layout {
  display: flex;
  height: calc(100vh - 84px);
  background-color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

/* --- 侧边栏样式 --- */
.sidebar {
  width: 260px;
  background-color: #f9f9f9;
  border-right: 1px solid #ebedf0;
  display: flex;
  flex-direction: column;
  transition: width 0.3s cubic-bezier(0.2, 0, 0, 1);
}

.sidebar-collapsed {
  width: 0;
  overflow: hidden;
  border-right: none;
}

.sidebar-header {
  padding: 20px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 12px;
}

.chat-card {
  margin-bottom: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 10px 12px;
  color: #333;
}

.chat-card:hover {
  background-color: #e6e8eb;
}

.chat-card.active {
  background-color: #e3f2fd; 
  color: #1976d2;
}

.chat-card-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-main {
  flex: 1;
  min-width: 0; 
  display: flex;
  flex-direction: column;
}

.chat-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-time {
  font-size: 12px;
  color: #999;
}

.chat-options {
  margin-left: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.chat-card:hover .chat-options {
  opacity: 1;
}

.option-icon {
  font-size: 16px;
  color: #666;
  padding: 4px;
}

/* --- 主内容区 --- */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 0;
}

.chat-header {
  height: 60px;
  border-bottom: 1px solid #ebedf0;
  display: flex;
  align-items: center;
  padding: 0 20px;
  background-color: #fff;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chat-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

/* --- 消息区域 --- */
.message-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background-color: #fff;
  scroll-behavior: smooth;
}

/* 欢迎页 */
.welcome-screen {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #333;
  padding-bottom: 100px;
}

.welcome-content {
  text-align: center;
  max-width: 600px;
}

.welcome-icon {
  font-size: 64px;
  color: #409EFF;
  margin-bottom: 24px;
}

.welcome-screen h2 {
  margin: 0 0 16px;
  font-weight: 600;
}

.welcome-screen p {
  color: #666;
  margin-bottom: 32px;
}

.suggestion-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.chip {
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  color: #606266;
}

.chip:hover {
  background: #ecf5ff;
  border-color: #b3d8ff;
  color: #409eff;
}

/* 消息气泡 */
.chat-list {
  max-width: 800px;
  margin: 0 auto;
}

.message-row {
  display: flex;
  margin-bottom: 24px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.avatar-wrapper {
  flex-shrink: 0;
  margin-right: 16px;
}

.message-row.user {
  flex-direction: row-reverse;
}

.message-row.user .avatar-wrapper {
  margin-right: 0;
  margin-left: 16px;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.ai-avatar {
  background: linear-gradient(135deg, #00C6FF 0%, #0072FF 100%);
  color: #fff;
}

.user-avatar {
  background-color: #f0f2f5;
  color: #606266;
}

.message-content-wrapper {
  max-width: calc(100% - 100px);
}

.message-bubble {
  padding: 12px 16px;
  border-radius: 12px;
  line-height: 1.6;
  font-size: 15px;
  position: relative;
}

.message-row.ai .message-bubble {
  background-color: #f4f6f8;
  color: #2c3e50;
  border-top-left-radius: 2px;
}

.message-row.user .message-bubble {
  background-color: #409EFF;
  color: #fff;
  border-top-right-radius: 2px;
}

/* Markdown 样式微调 */
.markdown-body {
  background: transparent !important;
  font-size: 15px;
}

.markdown-body ::v-deep(pre) {
  background: #282c34;
  border-radius: 6px;
  margin: 10px 0;
}

/* AI 消息额外内容区 (引用、按钮等) */
.ai-message-extras {
  margin-top: 8px;
}

/* --- 优化后的引用样式 (Accordion) --- */
.reference-accordion {
  margin-bottom: 8px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background-color: #ffffff;
  overflow: hidden;
}

.reference-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #f9fafc;
  cursor: pointer;
  transition: background-color 0.2s;
  user-select: none;
}

.reference-header:hover {
  background-color: #f0f2f5;
}

.ref-header-left {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #606266;
  font-weight: 500;
}

.ref-icon {
  margin-right: 6px;
  color: #409EFF;
}

.arrow-icon {
  font-size: 12px;
  color: #909399;
  transition: transform 0.3s;
}

.arrow-icon.is-active {
  transform: rotate(180deg);
}

.reference-body {
  border-top: 1px solid #ebeef5;
  background-color: #fff;
  padding: 4px 0;
}

.reference-item {
  padding: 8px 12px;
  border-bottom: 1px solid #f2f6fc;
}

.reference-item:last-child {
  border-bottom: none;
}

.ref-item-header {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.ref-item-idx {
  background-color: #f0f2f5;
  color: #909399;
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 4px;
  margin-right: 8px;
}

.ref-item-title {
  flex: 1;
  font-size: 13px;
  color: #303133;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.copy-btn {
  padding: 0 4px;
  height: auto;
  color: #909399;
}

.copy-btn:hover {
  color: #409EFF;
}

.ref-item-content {
  font-size: 12px;
  color: #606266;
  line-height: 1.5;
  padding-left: 24px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 消息操作按钮 */
.message-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
}

.action-btn {
  font-size: 14px;
  color: #909399;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.action-btn:hover {
  background-color: #f0f2f5;
  color: #606266;
}

/* 输入框区域 */
.input-wrapper {
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  padding: 0 20px 20px;
}

.input-box {
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 12px;
  padding: 10px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  transition: all 0.3s;
  display: flex;
  align-items: flex-end;
  position: relative;
}

.input-box:focus-within {
  border-color: #409eff;
  box-shadow: 0 2px 12px 0 rgba(64, 158, 255, 0.1);
}

.custom-textarea :deep(.el-textarea__inner) {
  border: none;
  box-shadow: none;
  padding: 8px;
  resize: none;
  max-height: 200px;
  background: transparent;
}

.send-btn-wrapper {
  padding-left: 10px;
  padding-bottom: 4px;
}

.input-footer-tip {
  text-align: center;
  font-size: 12px;
  color: #999;
  margin-top: 8px;
}

/* 打字动画 */
.typing-indicator {
  display: inline-flex;
  align-items: center;
  margin-top: 8px;
}

.dot {
  width: 6px;
  height: 6px;
  background: #b0b3b8;
  border-radius: 50%;
  margin-right: 4px;
  animation: bounce 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

@media (max-width: 768px) {
  .sidebar {
    position: absolute;
    height: 100%;
    z-index: 100;
    box-shadow: 2px 0 8px rgba(0,0,0,0.1);
  }
  .chat-list, .input-wrapper {
    max-width: 100%;
  }
}
</style>