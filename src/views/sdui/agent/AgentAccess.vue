<template>
  <div class="app-container agent-access">
    <el-card shadow="never">
      <template #header>Agent 接入</template>
      <p>导出终端原子能力的接入配置，供 Agent 或本地脚本查询设备、播放语音、控制灯光及显示内容。</p>
      <el-form label-position="top">
        <el-form-item label="服务根地址（调用方能够访问的地址，可包含反向代理前缀）">
          <el-input v-model="serviceRoot" placeholder="http://192.168.1.10:8080" />
          <div class="hint">本地开发请填写后端地址；远程调用请填写可访问的部署地址。</div>
        </el-form-item>
      </el-form>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="MCP 地址">{{ endpoints?.mcp || '请填写有效的 HTTP/HTTPS 地址' }}</el-descriptions-item>
        <el-descriptions-item label="HTTP API">{{ endpoints?.http || '—' }}</el-descriptions-item>
        <el-descriptions-item label="账号">{{ user.name || '—' }}</el-descriptions-item>
        <el-descriptions-item label="凭据有效期">{{ expiryLabel }}</el-descriptions-item>
        <el-descriptions-item label="操作范围">当前账号的全部终端</el-descriptions-item>
      </el-descriptions>
      <p class="hint">独立 Agent Token 覆盖当前账号全部终端，长期有效直到撤销。明文仅本次生成后可导出，请及时保存接入包；刷新页面后可生成新 Token。</p>
      <el-space wrap>
        <el-button :loading="creating" @click="createToken">生成 Agent Token</el-button>
        <el-button type="primary" :disabled="!canExport" :loading="exporting" @click="exportBundle">下载接入包</el-button>
        <el-button :disabled="!canExport" @click="copyMcp">复制 MCP 配置</el-button>
      </el-space>
      <p>接入包包含 mcp.json、http.json 和使用说明。连接后先查询设备，再按能力档案调用。</p>
      <pre>{{ preview }}</pre>
      <el-table :data="tokens" empty-text="暂无 Agent Token">
        <el-table-column prop="id" label="Token ID" />
        <el-table-column prop="createdAt" label="创建时间" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }"><el-button type="danger" link @click="revokeToken(row.id)">撤销</el-button></template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import JSZip from 'jszip';
import { ElMessage } from 'element-plus';
import useUserStore from '@/store/modules/user';
import request from '@/utils/request';

const user = useUserStore();
const exporting = ref(false);
const defaultRoot = new URL(import.meta.env.VITE_BASE_API || '/', window.location.origin).href.replace(/\/$/, '');
const serviceRoot = ref(defaultRoot);
const endpoints = computed(() => {
  try {
    const url = new URL(serviceRoot.value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    const base = url.href.replace(/\/+$/, '');
    return { mcp: `${base}/api/v1/sdui/mcp/agent`, http: `${base}/api/v1/sdui/agent` };
  } catch { return null; }
});
const activeCredential = ref(null);
const tokens = ref([]);
const creating = ref(false);
async function loadTokens() {
  const result = await request({ url: '/api/v1/sdui/agent-tokens', method: 'get' });
  tokens.value = result.data;
}
onMounted(() => loadTokens().catch(() => {}));
async function createToken() {
  creating.value = true;
  try {
    const result = await request({ url: '/api/v1/sdui/agent-tokens', method: 'post' });
    activeCredential.value = { ...result.data, expiresAt: null };
    await loadTokens();
    ElMessage.success('已生成，请复制配置或下载接入包保存');
  } catch (error) { ElMessage.error(error.message || '生成失败'); }
  finally { creating.value = false; }
}
async function revokeToken(id) {
  try {
    await request({ url: `/api/v1/sdui/agent-tokens/${encodeURIComponent(id)}`, method: 'delete' });
    if (activeCredential.value?.id === id) activeCredential.value = null;
    await loadTokens();
    ElMessage.success('已撤销');
  } catch (error) { ElMessage.error(error.message || '撤销失败'); }
}
function credential() {
  if (!activeCredential.value) throw new Error('请先生成 Agent Token');
  return activeCredential.value;
}
const expiryLabel = computed(() => '长期有效，直到撤销');
const canExport = computed(() => Boolean(endpoints.value && activeCredential.value));
function mcpConfig(token) {
  return { mcpServers: { agentnexus: { type: 'http', url: endpoints.value.mcp, headers: { Authorization: `Bearer ${token}` } } } };
}
const preview = computed(() => endpoints.value ? JSON.stringify(mcpConfig('<导出时填入凭据>'), null, 2) : '');
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function exportBundle() {
  exporting.value = true;
  try {
    if (!endpoints.value) throw new Error('请填写有效的服务根地址');
    const { token, expiresAt } = credential();
    const zip = new JSZip();
    zip.file('mcp.json', `${JSON.stringify(mcpConfig(token), null, 2)}\n`);
    zip.file('http.json', `${JSON.stringify({
      baseUrl: endpoints.value.http,
      headers: { Authorization: `Bearer ${token}` },
      account: user.name,
      expiresAt,
      devicesEndpoint: `${endpoints.value.http}/devices`
    }, null, 2)}\n`);
    zip.file('README.md', `# AgentNexus 原子能力接入\n\n账号：${user.name}\n凭据有效期：长期有效，直到撤销\n\n## MCP\n\n将 mcp.json 中的服务配置添加到支持 HTTP MCP 的客户端（客户端配置格式可能不同）。\n先调用 list_devices，再用 get_profile 获取目标设备的能力与 UI 契约。\n先在页面管理启用 Agent 场景并配置页面顺序。调用 connect_agent 显式接管，保存返回的 sessionId；后续设备操作（含 get_scene_status、release_agent）参数都携带 sessionId。再次接管签发新 UUID，旧 UUID 立即失效；普通操作不会自动接管。无心跳，也不声明 Agent 在线。\n临时展示最后一次更新3秒后恢复主页面；Agent 为主页面时保留最后内容。业务或音频忙碌时普通操作被拒绝。release_agent 主动释放控制会话。按钮交互需求已冻结。\n根据契约使用 speak、play_tone、play_audio、set_light、light_off、show_page、show_image、draw_canvas、preview_canvas、set_volume、set_brightness、show_idle。\n文件类工具使用 base64；成功表示请求获得终端确认，不表示音频已经播放结束。\n\n## HTTP / 脚本\n\n读取 http.json，使用 baseUrl 和 headers。\nGET /devices 查询设备；GET /devices/{deviceId}/profile 查询能力。\nPOST /devices/{deviceId}/scene/enter 显式接管，返回 {sessionId}；设备操作请求头加入 X-Agent-Session-Id。GET /devices/{deviceId}/scene 查询状态，POST /devices/{deviceId}/scene/release 释放会话，均携带该请求头。\n设备发现、读取能力及纯 Canvas 预览不要求控制会话。终端断线或服务重启后需要重新接入。\nPOST /devices/{deviceId}/tone，JSON 请求体：{"tone":"short"}。\nPOST /devices/{deviceId}/speak，JSON 请求体：{"text":"任务已完成"}。\nJSON 请求需设置 Content-Type: application/json。\nPOST /devices/{deviceId}/audio 或 /image 使用 multipart file。\nPOST /devices/{deviceId}/canvas 使用 JSON 绘制：{"text":"(^_^)","resolution":128,"colorBits":4}；默认单帧静态。多帧使用 frames，每帧是 text/commands 对象，仅多帧传 fps。\nPOST /devices/{deviceId}/canvas/preview 使用相同 JSON，仅返回最终量化 PNG 和生效参数，不发送终端。MCP preview_canvas 返回可查看的 image 内容。\n图片展示已有资源，自由绘制使用 draw_canvas；commands 支持 pixel/line/rect/circle，详见 get_profile(scope=canvas)。\nget_profile 支持 scope=all/operations/ui/audio/image/canvas；默认结构化结果，旧客户端可用 format=text 请求档案纯文本。缺字 missing_glyphs、溢出 text_overflow 均明确失败，不截断。\n其他操作路径为 /light、/light/off、/page，参数参照能力档案。\nPOST /devices/{deviceId}/volume，JSON：{"value":0}（静音，范围 0～100）。\nPOST /devices/{deviceId}/brightness，JSON：{"value":50}（范围 0～100）。\nPOST /devices/{deviceId}/idle，无请求体，显示等待页但不清除业务配置、不停止业务运行。\n能力档案 operations 提供 HTTP 路径、MCP 调用示例；surface.ui.examples 提供页面最小字段示例；按钮交互已冻结，show_page 不接收菜单或自定义规则组。UI 字符串限制单位是 UTF-8 字节，中文通常每字 3 字节。\n当前不提供立即停止扬声器播放的工具；音频 stop 确认不是实际声音播放结束。\nGET /access-log?limit=20 查看调用日志。\n操作响应的 ok 表示成功或失败；失败同时检查 HTTP 状态码、error 和 reason。\n\n## 凭据与测试\n\n使用独立 Agent Token，长期有效直到在接入页撤销。包内包含真实凭据，请勿提交仓库。明文仅生成时提供，请保存接入包；撤销后全部使用该 Token 的配置立即失效。\n终端须归属当前账号、在线且完成能力同步；文字播报需要平台 TTS 可用。\n服务地址须能从调用方访问。显示类操作会改变终端当前画面。\n`);
    download(await zip.generateAsync({ type: 'blob' }), 'agentnexus-access.zip');
    ElMessage.success('接入包已导出');
  } catch (error) { ElMessage.error(error.message || '导出失败'); }
  finally { exporting.value = false; }
}
async function copyMcp() {
  try {
    if (!endpoints.value) throw new Error('请填写有效的服务根地址');
    const text = JSON.stringify(mcpConfig(credential().token), null, 2);
    let copied = false;
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch { /* 浏览器拒绝剪贴板权限时使用页面内复制。 */ }
    }
    if (!copied) {
      const previousFocus = document.activeElement;
      const input = document.createElement('textarea');
      input.value = text;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      try {
        input.focus();
        input.select();
        copied = document.execCommand('copy');
      } finally {
        input.value = '';
        input.remove();
        previousFocus?.focus?.();
      }
    }
    if (!copied) throw new Error('浏览器不允许复制，请下载接入包获取 MCP 配置');
    ElMessage.success('已复制包含凭据的 MCP 配置');
  } catch (error) { ElMessage.error(error.message || '复制失败，请下载接入包'); }
}
</script>

<style scoped>
.agent-access { max-width: 1000px; }
.hint { color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.7; }
pre { background: var(--el-fill-color-light); padding: 16px; border-radius: 6px; overflow: auto; }
</style>
