<template>
  <div class="ai-chat-layout">
    <!-- 侧边栏 - 对话历史 -->
    <div class="sidebar" :class="{ 'sidebar-collapsed': !sidebarVisible }">
      <div class="sidebar-header-wrapper">
        <!-- Agent 选择器 -->
        <div class="agent-selector-area">
          <el-select 
            v-model="currentAgentId" 
            placeholder="选择 Agent" 
            class="agent-select"
            size="default"
            :disabled="isStreamLoading"
          >
            <el-option
              v-for="agent in agentList"
              :key="agent.id"
              :label="agent.name"
              :value="agent.id"
            >
              <span style="float: left">{{ agent.name }}</span>
              <span style="float: right; color: #8492a6; font-size: 12px; margin-left:8px">{{ agent.modelName }}</span>
            </el-option>
          </el-select>
        </div>

        <div class="sidebar-header">
          <h3>对话列表</h3>
          <el-button type="primary" :icon="Plus" circle @click="handleCreateChat" title="新建对话" size="small" />
        </div>
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
          <div class="header-info">
             <h3>{{ currentChatTitle || '新对话' }}</h3>
             <el-tag v-if="currentAgentId" size="small" type="success" effect="plain" class="header-agent-tag">
               {{ getCurrentAgentName() }}
             </el-tag>
          </div>
        </div>
      </div>

      <!-- 消息展示区域 -->
      <div 
        ref="messageContainer" 
        class="message-container" 
        v-loading="isMessageLoading"
        @scroll="handleScroll"
      >
        <!-- 空状态 -->
        <div v-if="(!currentChatId || currentMessages.length === 0) && !isMessageLoading" class="welcome-screen">
          <div class="welcome-content">
            <el-icon class="welcome-icon"><Promotion /></el-icon>
            <h2>你好，我是 {{ getCurrentAgentName() || 'AI 助手' }}</h2>
            <p>我可以帮你解答问题、调用工具、分析文档。</p>
            <div class="suggestion-chips">
              <span class="chip" @click="quickAsk('查询今天宿迁的天气')">🌦 查询宿迁天气</span>
              <span class="chip" @click="quickAsk('帮我写一个 Python 爬虫')">🐍 Python 爬虫示例</span>
              <span class="chip" @click="quickAsk('分析一下刚上传的财报')">📊 分析财报数据</span>
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
                <!-- 
                  核心变更：使用 segments 数组遍历渲染，实现文本与工具的时序穿插 
                -->
                <template v-for="(segment, segIndex) in message.segments" :key="segIndex">
                  
                  <!-- 类型A: 工具调用片段 -->
                  <div v-if="segment.type === 'tool'" class="tool-accordion-wrapper">
                    <div class="tool-accordion">
                       <div class="tool-header" @click.stop="toggleTool(segment)">
                         <div class="tool-header-left">
                           <el-icon class="tool-icon"><Tools /></el-icon>
                           <span class="tool-name">已调用工具: {{ segment.data.toolName }}</span>
                           <el-tag size="small" type="info" class="tool-cost">{{ segment.data.toolCost }}ms</el-tag>
                         </div>
                         <el-icon class="arrow-icon" :class="{ 'is-active': segment.isExpanded }"><ArrowDown /></el-icon>
                       </div>
                       <div v-show="segment.isExpanded" class="tool-body">
                         <div class="tool-result-label">执行结果:</div>
                         <div class="tool-result-content">{{ segment.data.toolResult }}</div>
                       </div>
                    </div>
                  </div>

                  <!-- 类型B: 文本片段 -->
                  <div 
                    v-else-if="segment.type === 'text'" 
                    class="markdown-body" 
                    v-html="renderMarkdown(segment.content)"
                  ></div>

                </template>
                
                <!-- 兼容旧数据或纯文本展示 (如果 segments 为空) -->
                <div v-if="!message.segments || message.segments.length === 0">
                   <div v-if="message.sender === 'ai'" class="markdown-body" v-html="renderMarkdown(message.text)" />
                   <div v-else class="user-text">{{ message.text }}</div>
                </div>

              </div>

              <!-- AI消息的底部功能区 -->
              <div v-if="message.sender === 'ai'" class="ai-message-extras">
                
                <!-- 引用文档展示 -->
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
                        <span class="ref-item-title">{{ doc.metadata?.originalFilename || '未知文档' }}</span>
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
                <div class="message-actions" v-if="message.segments && message.segments.some(s => s.type === 'text')">
                  <el-tooltip content="复制全部内容" placement="top" :show-after="500">
                    <div class="action-btn" @click="copyFullText(message)">
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
            :placeholder="isAgentReady ? '输入您的问题，按 Enter 发送...' : '正在连接 Agent...'"
            :disabled="isStreamLoading || !isAgentReady"
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
              :disabled="!userInput.trim() || isStreamLoading || !isAgentReady"
              @click="sendMessage"
            />
          </div>
        </div>
        <div class="input-footer-tip">
          当前对话基于 {{ getCurrentAgentName() }} 模型生成，内容仅供参考。
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { 
  fetchChatStream, 
  getUserConversations, 
  createConversation, 
  getConversationMessages,
  deleteConversation,
  renameConversation
} from '@/api/chat';
import { getAgentList } from '@/api/agent';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  Promotion, UserFilled, Plus, Expand, Fold, MoreFilled, 
  ChatLineRound, Document, CopyDocument, Collection, ArrowDown, Tools
} from '@element-plus/icons-vue';
import { ElMessageBox, ElMessage } from 'element-plus';

export default {
  name: 'AiChat',
  components: {
    Promotion, UserFilled, Plus, Expand, Fold, MoreFilled, 
    ChatLineRound, Document, CopyDocument, Collection, ArrowDown, Tools
  },
  setup() {
    return {
      Promotion, UserFilled, Plus, Expand, Fold, MoreFilled, 
      ChatLineRound, Document, CopyDocument, Collection, ArrowDown, Tools
    };
  },
  data() {
    return {
      sidebarVisible: true,
      userInput: '',
      isStreamLoading: false,
      isListLoading: false,
      isMessageLoading: false,
      
      agentList: [],
      currentAgentId: '',
      isAgentReady: false,

      currentChatId: null,
      currentChatTitle: '',
      chatHistory: [],
      currentMessages: [],
      
      // 滚动控制
      autoScrollEnabled: true, // 是否开启自动滚动
    };
  },
  watch: {
    // 监听消息变化，仅在开启自动滚动时执行滚动
    currentMessages: {
      handler() {
        if (this.autoScrollEnabled) {
          this.$nextTick(() => {
            this.scrollToBottom();
          });
        }
      },
      deep: true
    }
  },
  mounted() {
    this.initPage();
  },
  methods: {
    async initPage() {
      await this.initAgentList();
      await this.initChatList();
    },

    async initAgentList() {
      try {
        const res = await getAgentList();
        const list = Array.isArray(res) ? res : (res.data || []);
        this.agentList = list;
        if (this.agentList.length > 0) {
          this.currentAgentId = this.agentList[0].id;
          this.isAgentReady = true;
        } else {
          ElMessage.warning('暂无可用 Agent');
        }
      } catch (error) {
        console.error('获取 Agent 列表失败', error);
      }
    },

    getCurrentAgentName() {
      const agent = this.agentList.find(a => a.id === this.currentAgentId);
      return agent ? agent.name : '';
    },

    toggleSidebar() {
      this.sidebarVisible = !this.sidebarVisible;
    },

    toggleReference(index) {
      const msg = this.currentMessages[index];
      if (msg) msg.isRefExpanded = !msg.isRefExpanded;
      // 点击展开引用不触发 scrollToBottom，保持当前阅读位置
    },
    
    toggleTool(segment) {
      // 仅切换状态，不强制滚动
      segment.isExpanded = !segment.isExpanded;
    },

    quickAsk(text) {
      this.userInput = text;
      this.sendMessage();
    },

    async initChatList() {
      this.isListLoading = true;
      try {
        const res = await getUserConversations();
        const list = Array.isArray(res) ? res : (res.data || (res.list ? res.list : []));
        this.chatHistory = list || [];
        
        if (this.chatHistory.length > 0) {
          this.switchChat(this.chatHistory[0].id);
        } else {
          this.handleCreateChat();
        }
      } catch (error) {
        this.chatHistory = []; 
      } finally {
        this.isListLoading = false;
      }
    },

    handleCreateChat() {
      if (this.currentChatId !== null) {
        this.currentChatId = null;
        this.currentMessages = [];
        this.currentChatTitle = '新对话';
      }
    },

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
          
          // --- 历史数据适配 ---
          // 将历史数据转换为 segments 结构以便统一渲染
          const segments = [];
          
          // 1. 如果有工具调用，先放入 (因为历史记录通常不保存详细时序，此处采用默认顺序：工具在上，文本在下)
          // 如果想更精确，需要后端支持按时序返回 mixed list
          if (msg.tools && msg.tools.length > 0) {
            msg.tools.forEach(tool => {
              segments.push({
                type: 'tool',
                data: tool,
                isExpanded: false // 历史记录默认折叠
              });
            });
          }
          
          // 2. 文本内容
          const textContent = msg.content || msg.text || '';
          if (textContent) {
            segments.push({
              type: 'text',
              content: textContent
            });
          } else if (segments.length === 0) {
            // 防空
            segments.push({ type: 'text', content: '' });
          }

          return {
            sender: isUser ? 'user' : 'ai',
            segments: segments, // 新增：分段数据
            context: msg.context || [],
            isRefExpanded: false,
            timestamp: (msg.createTime || msg.timestamp) ? new Date(msg.createTime || msg.timestamp) : new Date()
          };
        });
        
        // 切换会话后，强制滚到底部并开启自动滚动
        this.autoScrollEnabled = true;
        this.scrollToBottom();
        
      } catch (error) {
        console.error('加载消息失败', error);
        this.currentMessages = [];
      } finally {
        this.isMessageLoading = false;
      }
    },

    handleChatCommand(command) {
      const { action, id, title } = command;
      if (action === 'rename') this.renameChat(id, title);
      else if (action === 'delete') this.deleteChat(id);
    },

    renameChat(chatId, oldTitle) {
      ElMessageBox.prompt('请输入新的对话名称', '重命名', {
        inputValue: oldTitle,
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        inputValidator: (val) => (!val || !val.trim()) ? '名称不能为空' : true
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
          const index = this.chatHistory.findIndex(c => c.id === chatId);
          if (index !== -1) this.chatHistory.splice(index, 1);
          if (this.currentChatId === chatId) {
            this.chatHistory.length > 0 ? this.switchChat(this.chatHistory[0].id) : this.handleCreateChat();
          }
          ElMessage.success('删除成功');
        } catch (error) {
          ElMessage.error('删除失败');
        }
      }).catch(() => {});
    },

    // --- 核心流式发送逻辑 ---
    async sendMessage() {
      const query = this.userInput.trim();
      if (!query || this.isStreamLoading) return;
      if (!this.currentAgentId) {
        ElMessage.warning('请先选择一个 Agent');
        return;
      }

      this.isStreamLoading = true;
      this.autoScrollEnabled = true; // 发送新消息时，强制开启自动滚动

      if (!this.currentChatId) {
        try {
          const title = query.length > 15 ? query.substring(0, 15) + '...' : query;
          const res = await createConversation(title);
          const newChat = (res && res.data) ? res.data : res;
          this.currentChatId = newChat.id;
          this.currentChatTitle = newChat.title;
          this.chatHistory.unshift(newChat);
        } catch (e) {
          ElMessage.error("创建会话失败");
          this.isStreamLoading = false;
          return;
        }
      }

      // 1. 用户消息
      this.currentMessages.push({
        sender: 'user',
        segments: [{ type: 'text', content: query }],
        timestamp: new Date()
      });
      this.userInput = '';
      
      // 2. 预置 AI 消息 (使用 segments)
      const aiMessage = {
        sender: 'ai',
        segments: [], // 初始为空，等待流填充
        context: [],
        isRefExpanded: false,
        timestamp: new Date()
      };
      this.currentMessages.push(aiMessage);
      
      // 强制滚动一次以显示新消息
      this.scrollToBottom();
      
      const aiMessageIndex = this.currentMessages.length - 1;

      // 3. 流式请求
      try {
        await fetchChatStream(
          { 
            query: query, 
            sessionId: this.currentChatId,
            agentId: this.currentAgentId 
          },
          (streamData) => {
            const { type, data } = streamData;
            const currentMsg = this.currentMessages[aiMessageIndex];
            
            // --- 文本事件 ---
            if (type === 'TEXT') {
               // 检查最后一个片段是否为文本
               const lastSegment = currentMsg.segments[currentMsg.segments.length - 1];
               if (lastSegment && lastSegment.type === 'text') {
                 // 追加到现有文本片段
                 lastSegment.content += data;
               } else {
                 // 新起一个文本片段
                 currentMsg.segments.push({ type: 'text', content: data });
               }
            } 
            // --- 引用文档 ---
            else if (type === 'CONTEXT') {
               currentMsg.context = data;
            }
            // --- 工具执行 (按时序嵌入) ---
            else if (type === 'TOOL_EXECUTION') {
               // 直接 push 一个新的工具片段
               currentMsg.segments.push({
                 type: 'tool',
                 data: data,
                 isExpanded: false // 默认收起
               });
            }
          },
          () => {
            this.isStreamLoading = false;
            const chat = this.chatHistory.find(c => c.id === this.currentChatId);
            if(chat) chat.updatedAt = new Date();
          },
          (error) => {
            this.isStreamLoading = false;
            const currentMsg = this.currentMessages[aiMessageIndex];
            if (currentMsg.segments.length === 0) {
               currentMsg.segments.push({ type: 'text', content: '网络连接异常，请重试。' });
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
      return (now - date < 86400000 && now.getDate() === date.getDate()) 
        ? `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
        : `${date.getMonth() + 1}月${date.getDate()}日`;
    },

    renderMarkdown(text) {
      if (!text) return '';
      marked.setOptions({ renderer: new marked.Renderer(), gfm: true, breaks: true });
      return DOMPurify.sanitize(marked.parse(text));
    },

    truncateText(text, length) {
      if (!text) return '';
      return text.length > length ? text.substring(0, length) + '...' : text;
    },

    copyText(text) {
      navigator.clipboard.writeText(text).then(() => ElMessage.success('已复制'));
    },
    
    copyFullText(message) {
      // 聚合所有文本片段
      const fullText = message.segments
        .filter(s => s.type === 'text')
        .map(s => s.content)
        .join('\n');
      this.copyText(fullText);
    },

    // --- 滚动控制 ---
    handleScroll(e) {
      const el = e.target;
      // 判定逻辑：如果用户向上滚动了（距离底部超过 50px），则暂停自动滚动
      const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceToBottom > 50) {
        this.autoScrollEnabled = false;
      } else {
        this.autoScrollEnabled = true;
      }
    },

    scrollToBottom() {
      // 只有在 autoScrollEnabled 为 true 时才执行 DOM 操作
      if (!this.autoScrollEnabled) return;
      
      const container = this.$refs.messageContainer;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
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

/* --- 侧边栏 --- */
.sidebar {
  width: 260px;
  background-color: #f9f9f9;
  border-right: 1px solid #ebedf0;
  display: flex;
  flex-direction: column;
  transition: width 0.3s cubic-bezier(0.2, 0, 0, 1);
}
.sidebar-collapsed { width: 0; overflow: hidden; border-right: none; }
.sidebar-header-wrapper { padding: 16px; background-color: #f9f9f9; border-bottom: 1px solid #eee; }
.agent-selector-area { margin-bottom: 12px; }
.agent-select { width: 100%; }
.sidebar-header { display: flex; justify-content: space-between; align-items: center; }
.sidebar-header h3 { margin: 0; font-size: 14px; font-weight: 600; color: #606266; }
.sidebar-content { flex: 1; overflow-y: auto; padding: 12px; }

/* 侧边栏卡片 */
.chat-card {
  margin-bottom: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;
  padding: 10px 12px; color: #333;
}
.chat-card:hover { background-color: #e6e8eb; }
.chat-card.active { background-color: #e3f2fd; color: #1976d2; }
.chat-card-inner { display: flex; justify-content: space-between; align-items: center; }
.chat-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.chat-title { font-size: 14px; font-weight: 500; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chat-time { font-size: 12px; color: #999; }
.chat-options { margin-left: 8px; opacity: 0; transition: opacity 0.2s; }
.chat-card:hover .chat-options { opacity: 1; }
.option-icon { font-size: 16px; color: #666; padding: 4px; }

/* --- 主内容区 --- */
.main-content { flex: 1; display: flex; flex-direction: column; position: relative; min-width: 0; }
.chat-header { height: 60px; border-bottom: 1px solid #ebedf0; display: flex; align-items: center; padding: 0 20px; background-color: #fff; z-index: 10; }
.header-left { display: flex; align-items: center; gap: 12px; }
.header-info { display: flex; align-items: center; gap: 10px; }
.chat-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
.header-agent-tag { border-radius: 12px; }

/* --- 消息区域 --- */
.message-container { flex: 1; overflow-y: auto; padding: 20px; background-color: #fff; scroll-behavior: auto; /* 移除 smooth 以便于精确控制 */ }
.welcome-screen { height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; color: #333; padding-bottom: 100px; }
.welcome-content { text-align: center; max-width: 600px; }
.welcome-icon { font-size: 64px; color: #409EFF; margin-bottom: 24px; }
.welcome-screen h2 { margin: 0 0 16px; font-weight: 600; }
.suggestion-chips { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.chip { background: #f5f7fa; border: 1px solid #e4e7ed; padding: 8px 16px; border-radius: 20px; font-size: 13px; cursor: pointer; transition: all 0.2s; color: #606266; }
.chip:hover { background: #ecf5ff; border-color: #b3d8ff; color: #409eff; }

.chat-list { max-width: 800px; margin: 0 auto; }
.message-row { display: flex; margin-bottom: 24px; }
.avatar-wrapper { flex-shrink: 0; margin-right: 16px; }
.message-row.user { flex-direction: row-reverse; }
.message-row.user .avatar-wrapper { margin-right: 0; margin-left: 16px; }
.avatar { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.ai-avatar { background: linear-gradient(135deg, #00C6FF 0%, #0072FF 100%); color: #fff; }
.user-avatar { background-color: #f0f2f5; color: #606266; }
.message-content-wrapper { max-width: calc(100% - 100px); flex: 1; }

.message-bubble {
  padding: 12px 16px; border-radius: 12px; line-height: 1.6; font-size: 15px; position: relative;
}
.message-row.ai .message-bubble { background-color: #f4f6f8; color: #2c3e50; border-top-left-radius: 2px; }
.message-row.user .message-bubble { background-color: #409EFF; color: #fff; border-top-right-radius: 2px; }

/* Markdown & 工具卡片共存样式 */
.markdown-body { background: transparent !important; font-size: 15px; }
.markdown-body ::v-deep(pre) { background: #282c34; border-radius: 6px; margin: 10px 0; }
.markdown-body ::v-deep(img) { max-width: 100%; height: auto; display: block; margin: 8px 0; border-radius: 4px; }

.tool-accordion-wrapper { margin: 8px 0; }
.tool-accordion {
  border: 1px solid #e6a23c; border-radius: 6px; background-color: #fdf6ec; overflow: hidden;
}
.tool-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 10px; background-color: #fdf6ec; cursor: pointer; user-select: none;
}
.tool-header:hover { background-color: #faecd8; }
.tool-header-left { display: flex; align-items: center; font-size: 13px; color: #b88230; font-weight: 500; }
.tool-icon { margin-right: 6px; font-size: 14px; }
.tool-name { margin-right: 8px; }
.tool-cost { transform: scale(0.9); }
.arrow-icon { font-size: 12px; color: #b88230; transition: transform 0.3s; }
.arrow-icon.is-active { transform: rotate(180deg); }
.tool-body {
  border-top: 1px dashed #e6a23c; background-color: #fff; padding: 8px 10px; font-size: 12px; color: #333;
}
.tool-result-label { font-weight: bold; margin-bottom: 4px; color: #666; }
.tool-result-content { 
  white-space: pre-wrap; font-family: monospace; background: #fafafa; padding: 4px; border-radius: 4px;
}

/* 引用文档 */
.ai-message-extras { margin-top: 8px; }
.reference-accordion { margin-bottom: 8px; border: 1px solid #e4e7ed; border-radius: 8px; background-color: #ffffff; overflow: hidden; }
.reference-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background-color: #f9fafc; cursor: pointer; }
.ref-header-left { display: flex; align-items: center; font-size: 13px; color: #606266; font-weight: 500; }
.ref-icon { margin-right: 6px; color: #409EFF; }
.reference-body { border-top: 1px solid #ebeef5; background-color: #fff; padding: 4px 0; }
.reference-item { padding: 8px 12px; border-bottom: 1px solid #f2f6fc; }
.reference-item:last-child { border-bottom: none; }
.ref-item-header { display: flex; align-items: center; margin-bottom: 4px; }
.ref-item-idx { background-color: #f0f2f5; color: #909399; font-size: 11px; padding: 1px 5px; border-radius: 4px; margin-right: 8px; }
.ref-item-title { flex: 1; font-size: 13px; color: #303133; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.copy-btn { padding: 0 4px; height: auto; color: #909399; }
.ref-item-content { font-size: 12px; color: #606266; line-height: 1.5; padding-left: 24px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* 底部操作 */
.message-actions { display: flex; align-items: center; gap: 8px; padding: 0 4px; }
.action-btn { font-size: 14px; color: #909399; cursor: pointer; padding: 4px; border-radius: 4px; }
.action-btn:hover { background-color: #f0f2f5; color: #606266; }

/* 输入框 */
.input-wrapper { max-width: 800px; margin: 0 auto; width: 100%; padding: 0 20px 20px; }
.input-box { background: #fff; border: 1px solid #dcdfe6; border-radius: 12px; padding: 10px; box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05); transition: all 0.3s; display: flex; align-items: flex-end; position: relative; }
.input-box:focus-within { border-color: #409eff; box-shadow: 0 2px 12px 0 rgba(64, 158, 255, 0.1); }
.custom-textarea :deep(.el-textarea__inner) { border: none; box-shadow: none; padding: 8px; resize: none; max-height: 200px; background: transparent; }
.send-btn-wrapper { padding-left: 10px; padding-bottom: 4px; }
.input-footer-tip { text-align: center; font-size: 12px; color: #999; margin-top: 8px; }
.typing-indicator { display: inline-flex; align-items: center; margin-top: 8px; }
.dot { width: 6px; height: 6px; background: #b0b3b8; border-radius: 50%; margin-right: 4px; animation: bounce 1.4s infinite ease-in-out both; }
.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }

@media (max-width: 768px) {
  .sidebar { position: absolute; height: 100%; z-index: 100; box-shadow: 2px 0 8px rgba(0,0,0,0.1); }
  .chat-list, .input-wrapper { max-width: 100%; }
}
</style>