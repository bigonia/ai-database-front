import request from '@/utils/request';
import { getToken } from '@/utils/auth';
import { useSpaceStore } from '@/store/modules/space';

// 定义双重 Base URL 以适配混合后端架构
const LEGACY_BASE_URL = '/api/ai';       // 旧版管理接口地址
const AGENT_BASE_URL = '/api/v1/agent';  // 新版 Agent 服务地址

/**
 * 1. 获取会话列表 (保持原有逻辑)
 * 路径: /api/ai/conversations
 */
export function getUserConversations() {
  return request({
    url: `${LEGACY_BASE_URL}/conversations`,
    method: 'get'
  });
}

/**
 * 2. 创建新会话 (保持原有逻辑)
 * 路径: /api/ai/conversations
 * @param {string} title - 会话标题
 */
export function createConversation(title) {
  return request({
    url: `${LEGACY_BASE_URL}/conversations`,
    method: 'post',
    data: { title }
  });
}

/**
 * 3. 获取某个会话的具体消息历史 (已迁移)
 * 路径: /api/v1/agent/history/{conversationId}
 * 说明: 接口已更新为 Agent 服务下的 /history/{id}
 * @param {string} conversationId - 会话ID
 */
export function getConversationMessages(conversationId) {
  return request({
    url: `${AGENT_BASE_URL}/history/${conversationId}`,
    method: 'get'
  });
}

/**
 * 4. 删除会话 (保持原有逻辑)
 * 路径: /api/ai/conversations/{conversationId}
 * @param {string} conversationId - 会话ID
 */
export function deleteConversation(conversationId) {
  return request({
    url: `${LEGACY_BASE_URL}/conversations/${conversationId}`,
    method: 'delete'
  });
}

/**
 * 5. 重命名会话 (保持原有逻辑)
 * 路径: /api/ai/conversations/{conversationId}/title
 * @param {string} conversationId - 会话ID
 * @param {string} title - 新标题
 */
export function renameConversation(conversationId, title) {
  return request({
    url: `${LEGACY_BASE_URL}/conversations/${conversationId}/title`,
    method: 'patch',
    data: { title }
  });
}

/**
 * 发送消息至 Agent 聊天接口并处理流式响应 (已迁移)
 * 路径: /api/v1/agent/chat
 */
export async function fetchChatStream(data, onData, onFinish, onError) {
  try {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const spaceStore = useSpaceStore();
    if (spaceStore.currentSpaceId) {
      headers['X-Space-Id'] = spaceStore.currentSpaceId;
    }

    // 从 data 中解构出 agentId，剩余部分作为 body
    const { agentId, ...bodyData } = data;
    
    // 构造带参数的 URL
    const url = `${AGENT_BASE_URL}/chat?agentId=${agentId || ''}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(bodyData)
    });

    if (!response.ok) {
      throw new Error(`HTTP 错误! 状态码: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    const processStream = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.length > 0) console.warn('流结束时缓冲区仍有数据:', buffer);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('data:');

        for (let i = 0; i < parts.length - 1; i++) {
          const chunk = parts[i].trim();
          if (chunk) {
            try {
              // 尝试解析 JSON
              const json = JSON.parse(chunk);
              onData(json);
            } catch (e) {
              console.warn('非 JSON 数据块或解析失败:', chunk);
            }
          }
        }
        buffer = parts[parts.length - 1];
      }
      onFinish();
    };

    await processStream();
  } catch (error) {
    console.error('获取聊天流时出错:', error);
    onError(error);
  }
}