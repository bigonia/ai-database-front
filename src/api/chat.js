import request from '@/utils/request';
import axios from 'axios';
import { getToken } from '@/utils/auth';
import { useSpaceStore } from '@/store/modules/space';

/**
 * AI 对话 API 模块
 */

/**
 * 1. 获取会话列表
 * 已移除 userId 参数
 */
export function getUserConversations() {
  return request({
    url: '/api/ai/conversations',
    method: 'get'
  });
}

/**
 * 2. 创建新会话
 * @param {string} title - 会话标题
 */
export function createConversation(title) {
  return request({
    url: '/api/ai/conversations',
    method: 'post',
    data: { title }
  });
}

/**
 * 3. 获取某个会话的具体消息历史
 * @param {string} conversationId - 会话ID
 */
export function getConversationMessages(conversationId) {
  return request({
    url: `/api/ai/conversations/${conversationId}/messages`,
    method: 'get'
  });
}

/**
 * 4. 删除会话
 * @param {string} conversationId - 会话ID
 */
export function deleteConversation(conversationId) {
  return request({
    url: `/api/ai/conversations/${conversationId}`,
    method: 'delete'
  });
}

/**
 * 5. 重命名会话
 * @param {string} conversationId - 会话ID
 * @param {string} title - 新标题
 */
export function renameConversation(conversationId, title) {
  return request({
    url: `/api/ai/conversations/${conversationId}/title`,
    method: 'patch',
    data: { title }
  });
}

/**
 * 发送消息至 RAG 聊天接口并处理流式响应
 * 注意：假设流式接口 URL 保持不变，且 sessionId 对应 conversationId
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
      // 自定义 Header Key，请根据后端要求修改，例如 'X-Space-Id' 或 'Tenant-Id'
      headers['X-Space-Id'] = spaceStore.currentSpaceId;
    }

    const response = await fetch(`/api/v1/chat-client/stream`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(data)
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
              const json = JSON.parse(chunk);
              onData(json);
            } catch (e) {
              console.error('解析流数据块时出错:', chunk, e);
              onError(new Error('无法解析流数据。'));
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