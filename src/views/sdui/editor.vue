<template>
  <div class="editor-shell">
    <!-- Toolbar -->
    <div class="editor-toolbar">
      <el-button @click="goBack">← 返回列表</el-button>
      <el-input
        v-model="workflowName"
        placeholder="工作流名称"
        class="toolbar-name-input"
        size="default"
      />
      <el-input
        v-model="workflowIcon"
        placeholder="图标"
        class="toolbar-icon-input"
        size="default"
      />
      <div class="toolbar-right">
        <span v-if="workflowId" class="wf-id">ID: {{ workflowId }}</span>
        <el-input
          v-else
          v-model="workflowIdInput"
          placeholder="工作流 ID (英文+下划线)"
          class="toolbar-id-input"
          size="default"
        />
        <el-button @click="openPagesDialog">页面配置</el-button>
        <el-button type="primary" :loading="loading.save" @click="handleSave">保存</el-button>
      </div>
    </div>

    <div class="editor-main">
      <!-- Left Panel: Node Types -->
      <div class="left-panel">
        <div class="panel-section">
          <div class="panel-title">触发器</div>
          <div
            v-for="t in nodeTypes.triggers"
            :key="t.type"
            class="dnd-item trigger-item"
            draggable="true"
            @dragstart="onDragStart($event, 'trigger', t)"
          >
            <span class="dnd-dot trigger-dot" />
            <div>
              <div class="dnd-label">{{ t.label }}</div>
              <div class="dnd-type">{{ t.type }}</div>
            </div>
          </div>
        </div>

        <div class="panel-section">
          <div class="panel-title">动作</div>
          <div
            v-for="a in nodeTypes.actions"
            :key="a.type"
            class="dnd-item action-item"
            draggable="true"
            @dragstart="onDragStart($event, 'action', a)"
          >
            <span class="dnd-dot action-dot" />
            <div>
              <div class="dnd-label">{{ a.label }}</div>
              <div class="dnd-type">{{ a.type }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Center: Canvas -->
      <div
        class="canvas-area"
        @drop="onDrop"
        @dragover.prevent
      >
        <VueFlow
          ref="vueFlowRef"
          v-model:nodes="nodes"
          v-model:edges="edges"
          :node-types="customNodeTypes"
          :default-viewport="{ x: 0, y: 0, zoom: 1 }"
          :snap-to-grid="true"
          :snap-grid="[16, 16]"
          fit-view-on-init
          @node-click="onNodeClick"
          @nodes-change="onNodesChange"
          @connect="onConnect"
        >
          <Background />
          <Controls />
        </VueFlow>
      </div>

      <!-- Right Panel: Properties -->
      <div class="right-panel">
        <template v-if="selectedNode">
          <div class="panel-title">{{ selectedNode.data?.label || selectedNode.type }}</div>

          <el-form label-width="80px" size="small">
            <el-form-item label="ID">
              <el-input v-model="selectedNode.data.id" @change="onNodeDataChange" />
            </el-form-item>

            <!-- Trigger params -->
            <template v-if="selectedNode.type === 'trigger'">
              <el-form-item v-if="selectedNode.data.type === 'cron'" label="间隔(秒)">
                <el-input-number v-model="selectedNode.data.params.interval" :min="1" style="width:100%" @change="onNodeDataChange" />
              </el-form-item>
              <el-form-item v-if="selectedNode.data.type === 'cron'" label="Cron">
                <el-input v-model="selectedNode.data.params.cron" placeholder="可选 cron 表达式" @change="onNodeDataChange" />
              </el-form-item>
              <el-form-item v-if="selectedNode.data.type === 'webhook'" label="路径">
                <el-input v-model="selectedNode.data.params.path" @change="onNodeDataChange" />
              </el-form-item>
              <el-form-item v-if="selectedNode.data.type === 'webhook'" label="回调 URL">
                <el-input :model-value="webhookUrl(selectedNode.data.params.path)" readonly />
              </el-form-item>
              <el-form-item v-if="selectedNode.data.type === 'device_event'" label="事件">
                <el-input v-model="selectedNode.data.params.event" @change="onNodeDataChange" />
              </el-form-item>
            </template>

            <!-- Action params -->
            <template v-if="selectedNode.type === 'action'">
              <el-form-item v-if="selectedNode.data.type === 'fetch'" label="URL">
                <el-input v-model="selectedNode.data.params.url" @change="onNodeDataChange" />
              </el-form-item>
              <el-form-item v-if="selectedNode.data.type === 'fetch'" label="Method">
                <el-select v-model="selectedNode.data.params.method" style="width:100%" @change="onNodeDataChange">
                  <el-option label="GET" value="GET" />
                  <el-option label="POST" value="POST" />
                  <el-option label="PUT" value="PUT" />
                  <el-option label="DELETE" value="DELETE" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="selectedNode.data.type === 'fetch'" label="Body">
                <el-input v-model="selectedNode.data.params.body" type="textarea" :rows="2" placeholder="请求体 JSON" @change="onNodeDataChange" />
              </el-form-item>
              <el-form-item v-if="selectedNode.data.type === 'fetch'" label="保存为">
                <el-input v-model="selectedNode.data.params.save" @change="onNodeDataChange" />
              </el-form-item>

              <el-form-item v-if="selectedNode.data.type === 'update_page' || selectedNode.data.type === 'switch_page'" label="页面">
                <el-select v-model="selectedNode.data.params.page" style="width:100%" @change="onNodeDataChange">
                  <el-option v-for="p in pages" :key="p.id" :label="p.id" :value="p.id" />
                </el-select>
              </el-form-item>

              <el-form-item v-if="selectedNode.data.type === 'patch_section'" label="页面">
                <el-select v-model="selectedNode.data.params.page" style="width:100%" @change="onNodeDataChange">
                  <el-option v-for="p in pages" :key="p.id" :label="p.id" :value="p.id" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="selectedNode.data.type === 'patch_section'" label="Section ID">
                <el-input v-model="selectedNode.data.params.sectionId" @change="onNodeDataChange" />
              </el-form-item>
              <el-form-item v-if="selectedNode.data.type === 'patch_section'" label="Bind">
                <el-input v-model="selectedNode.data.params.bind" type="textarea" :rows="2" placeholder='{"field": "$data.xxx"}' @change="onNodeDataChange" />
              </el-form-item>

              <el-form-item v-if="selectedNode.data.type === 'play_audio'" label="预设">
                <el-select v-model="selectedNode.data.params.preset" style="width:100%" @change="onNodeDataChange">
                  <el-option label="notification" value="notification" />
                  <el-option label="alert" value="alert" />
                  <el-option label="success" value="success" />
                </el-select>
              </el-form-item>

              <el-form-item v-if="selectedNode.data.type === 'tts' || selectedNode.data.type === 'play_audio'" label="文本">
                <el-input v-model="selectedNode.data.params.text" @change="onNodeDataChange" />
              </el-form-item>

              <el-form-item v-if="selectedNode.data.type === 'control'" label="命令">
                <el-input v-model="selectedNode.data.params.command" @change="onNodeDataChange" />
              </el-form-item>
              <el-form-item v-if="selectedNode.data.type === 'control'" label="值">
                <el-input v-model="selectedNode.data.params.value" @change="onNodeDataChange" />
              </el-form-item>
            </template>

            <el-divider />
            <el-button type="danger" plain size="small" @click="deleteSelectedNode">删除节点</el-button>
          </el-form>
        </template>
        <template v-else>
          <div class="panel-hint">点击画布中的节点<br />查看和编辑属性</div>
        </template>
      </div>
    </div>

    <!-- Pages/Sections Dialog -->
    <el-dialog v-model="dialogs.pages" title="页面配置" width="800px" destroy-on-close>
      <el-tabs v-model="pagesTab" type="card">
        <el-tab-pane v-for="(page, pi) in pages" :key="page.id" :label="page.id" :name="page.id">
          <el-form label-width="100px" size="small">
            <el-form-item label="Page ID">
              <el-input v-model="page.id" @change="syncPages" />
            </el-form-item>
            <el-form-item label="布局">
              <el-select v-model="page.layout" @change="syncPages">
                <el-option label="vertical_scroll" value="vertical_scroll" />
                <el-option label="horizontal_pages" value="horizontal_pages" />
                <el-option label="fixed_single" value="fixed_single" />
              </el-select>
            </el-form-item>
            <el-form-item label="自动滚动">
              <el-switch v-model="page.autoScroll" @change="syncPages" />
            </el-form-item>
            <el-form-item v-if="page.autoScroll" label="滚动间隔(ms)">
              <el-input-number v-model="page.autoScrollMs" :min="0" :step="500" @change="syncPages" />
            </el-form-item>
          </el-form>

          <el-divider />
          <div class="section-header">
            <span>Sections</span>
            <el-button size="small" @click="addSection(page)">添加 Section</el-button>
          </div>

          <el-table :data="page.sections" size="small">
            <el-table-column prop="id" label="ID" width="120">
              <template #default="{ row, $index }">
                <el-input v-model="row.id" size="small" @change="syncPages" />
              </template>
            </el-table-column>
            <el-table-column prop="type" label="类型" width="180">
              <template #default="{ row, $index }">
                <el-select v-model="row.type" size="small" @change="onSectionTypeChange(row)">
                  <el-option v-for="st in nodeTypes.sectionTypes" :key="st.type" :label="st.label" :value="st.type" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="Bind 字段" min-width="260">
              <template #default="{ row }">
                <div v-for="(_, field) in row.bind" :key="field" class="bind-row">
                  <span class="bind-field">{{ field }}</span>
                  <el-input v-model="row.bind[field]" size="small" placeholder="表达式" @change="syncPages" />
                </div>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ $index }">
                <el-button link type="danger" size="small" @click="removeSection(page, $index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <el-button @click="addPage">添加页面</el-button>
        <el-button @click="removePage">删除当前页面</el-button>
        <el-button type="primary" @click="dialogs.pages = false">完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus';
import { h, markRaw } from 'vue';
import { VueFlow, Handle, Position } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';

import {
  createWorkflowDefinition,
  getWorkflowDefinition,
  getWorkflowNodeTypes,
  updateWorkflowDefinition
} from '@/api/sdui';

// Custom node components
const TriggerNode = {
  props: ['id', 'data', 'selected'],
  setup(props) {
    const iconMap = { manual: '👆', cron: '⏰', webhook: '🪝', device_event: '📱' };
    return () => h('div', {
      class: ['flow-node', 'trigger-node', { selected: props.selected }]
    }, [
      h('div', { class: 'node-content' }, [
        h('span', { class: 'node-icon' }, iconMap[props.data?.type] || '⚡'),
        h('span', { class: 'node-label' }, props.data?.label || props.data?.id)
      ]),
      h(Handle, { type: 'source', position: Position.Right })
    ]);
  }
};

const ActionNode = {
  props: ['id', 'data', 'selected'],
  setup(props) {
    const iconMap = {
      fetch: '🌐', update_page: '📄', patch_section: '🔧',
      play_audio: '🔊', tts: '🗣', switch_page: '🔄', control: '🎮'
    };
    return () => h('div', {
      class: ['flow-node', 'action-node', { selected: props.selected }]
    }, [
      h(Handle, { type: 'target', position: Position.Left }),
      h('div', { class: 'node-content' }, [
        h('span', { class: 'node-icon' }, iconMap[props.data?.type] || '▶'),
        h('span', { class: 'node-label' }, props.data?.label || props.data?.id)
      ]),
      h(Handle, { type: 'source', position: Position.Right })
    ]);
  }
};

let idCounter = 0;
function uid(prefix) {
  return `${prefix}_${Date.now()}_${++idCounter}`;
}

const TRIGGER_COLORS = {
  manual: '#3b82f6', cron: '#6366f1', webhook: '#8b5cf6', device_event: '#06b6d4'
};

const ACTION_COLORS = {
  fetch: '#10b981', update_page: '#f59e0b', patch_section: '#f97316',
  play_audio: '#ef4444', tts: '#ec4899', switch_page: '#14b8a6', control: '#6366f1'
};

export default {
  name: 'SduiEditor',
  components: { VueFlow, Background, Controls },
  data() {
    return {
      loading: {
        init: false,
        save: false
      },
      workflowId: '',
      workflowIdInput: '',
      workflowName: '',
      workflowIcon: '',
      nodeTypes: { triggers: [], actions: [], sectionTypes: [] },
      nodes: [],
      edges: [],
      pages: [],
      pagesTab: '',
      selectedNode: null,
      dialogs: {
        pages: false
      },
      customNodeTypes: {
        trigger: markRaw(TriggerNode),
        action: markRaw(ActionNode)
      }
    };
  },
  computed: {
    webhookUrl() {
      return (path) => {
        const base = window.location.origin;
        return `${base}/api/v1/sdui/webhook/${path || '<path>'}`;
      };
    }
  },
  async created() {
    this.workflowId = this.$route.params.id || '';
    await this.loadNodeTypes();
    if (this.workflowId) {
      await this.loadWorkflow();
    }
  },
  methods: {
    async loadNodeTypes() {
      try {
        const res = await getWorkflowNodeTypes();
        this.nodeTypes = res?.data || { triggers: [], actions: [], sectionTypes: [] };
      } catch {
        ElMessage.error('加载节点类型失败');
      }
    },

    async loadWorkflow() {
      this.loading.init = true;
      try {
        const res = await getWorkflowDefinition(this.workflowId);
        const wf = res?.data || {};
        this.workflowName = wf.name || '';
        this.workflowIcon = wf.icon || '';

        let def = {};
        if (typeof wf.definitionJson === 'string') {
          def = JSON.parse(wf.definitionJson);
        } else if (typeof wf.definitionJson === 'object') {
          def = wf.definitionJson;
        }

        this.buildGraph(def);
      } catch {
        ElMessage.error('加载工作流失败');
      } finally {
        this.loading.init = false;
      }
    },

    buildGraph(def) {
      const newNodes = [];
      const newEdges = [];
      let y = 80;

      // Trigger nodes
      (def.triggers || []).forEach((t, i) => {
        const x = 120;
        newNodes.push({
          id: `trg_${t.id}`,
          type: 'trigger',
          position: { x, y: y + i * 120 },
          data: {
            id: t.id,
            type: t.type,
            label: this.getTriggerLabel(t.type),
            params: {
              interval: t.interval || 60,
              cron: t.cron || '',
              path: t.path || '',
              event: t.event || ''
            }
          },
          style: { background: TRIGGER_COLORS[t.type] || '#3b82f6' }
        });
      });

      // Action nodes + edges from actions map
      y = 80;
      Object.entries(def.actions || {}).forEach(([triggerId, actionList]) => {
        (actionList || []).forEach((a, ai) => {
          const nodeId = `act_${triggerId}_${ai}`;
          newNodes.push({
            id: nodeId,
            type: 'action',
            position: { x: 400 + ai * 200, y },
            data: {
              id: a.id || `${triggerId}_a${ai}`,
              type: a.type,
              label: this.getActionLabel(a.type),
              params: {
                url: a.url || '',
                method: a.method || 'GET',
                body: a.body || '',
                save: a.save || '',
                page: a.page || '',
                sectionId: a.sectionId || '',
                bind: typeof a.bind === 'object' ? JSON.stringify(a.bind) : (a.bind || ''),
                preset: a.preset || 'notification',
                text: a.text || '',
                command: a.command || '',
                value: a.value || ''
              }
            },
            style: { background: ACTION_COLORS[a.type] || '#10b981' }
          });

          // Edge from trigger to first action, or action to next action
          if (ai === 0) {
            newEdges.push({
              id: `e_${triggerId}_${ai}`,
              source: `trg_${triggerId}`,
              target: nodeId,
              animated: true
            });
          } else {
            newEdges.push({
              id: `e_${triggerId}_${ai}`,
              source: `act_${triggerId}_${ai - 1}`,
              target: nodeId,
              animated: true
            });
          }

          y += 100;
        });
        y += 40;
      });

      this.nodes = newNodes;
      this.edges = newEdges;
      this.pages = (def.pages || []).map(p => ({
        ...p,
        sections: (p.sections || []).map(s => ({ ...s }))
      }));
      if (this.pages.length > 0) {
        this.pagesTab = this.pages[0].id;
      }
    },

    buildDefinitionJson() {
      const triggers = [];
      const actions = {};

      const triggerNodes = this.nodes.filter(n => n.type === 'trigger');
      const actionNodes = this.nodes.filter(n => n.type === 'action');

      triggerNodes.forEach(tn => {
        const t = {
          type: tn.data.type,
          id: tn.data.id
        };
        if (tn.data.type === 'cron') {
          t.interval = tn.data.params.interval || 60;
          if (tn.data.params.cron) t.cron = tn.data.params.cron;
        }
        if (tn.data.type === 'webhook') {
          t.path = tn.data.params.path || '';
        }
        if (tn.data.type === 'device_event') {
          t.event = tn.data.params.event || '';
        }
        triggers.push(t);

        // Find all actions connected to this trigger (BFS)
        const chainNodeIds = [];
        const queue = [tn.id];
        const visited = new Set();

        while (queue.length > 0) {
          const current = queue.shift();
          const outEdges = this.edges.filter(e => e.source === current);
          outEdges.forEach(e => {
            if (!visited.has(e.target)) {
              visited.add(e.target);
              queue.push(e.target);
              chainNodeIds.push(e.target);
            }
          });
        }

        const chainActions = chainNodeIds
          .map(nid => actionNodes.find(an => an.id === nid))
          .filter(Boolean)
          .map(an => this.serializeAction(an.data));

        if (chainActions.length > 0) {
          actions[tn.data.id] = chainActions;
        }
      });

      return {
        id: this.workflowId,
        name: this.workflowName,
        icon: this.workflowIcon,
        pages: this.pages.map(p => ({
          id: p.id,
          layout: p.layout,
          autoScroll: p.autoScroll,
          autoScrollMs: p.autoScrollMs || 0,
          sections: p.sections.map(s => ({ ...s }))
        })),
        triggers,
        actions
      };
    },

    serializeAction(data) {
      const params = data.params || {};
      const result = { type: data.type };

      if (data.type === 'fetch') {
        result.url = params.url || '';
        result.method = params.method || 'GET';
        if (params.body) result.body = params.body;
        result.save = params.save || '';
      } else if (data.type === 'update_page' || data.type === 'switch_page') {
        result.page = params.page || '';
      } else if (data.type === 'patch_section') {
        result.page = params.page || '';
        result.sectionId = params.sectionId || '';
        try {
          result.bind = JSON.parse(params.bind || '{}');
        } catch {
          result.bind = params.bind || {};
        }
      } else if (data.type === 'play_audio') {
        result.preset = params.preset || 'notification';
        if (params.text) result.text = params.text;
      } else if (data.type === 'tts') {
        result.text = params.text || '';
      } else if (data.type === 'control') {
        result.command = params.command || '';
        result.value = params.value || '';
      }

      return result;
    },

    getTriggerLabel(type) {
      const found = this.nodeTypes.triggers?.find(t => t.type === type);
      return found?.label || type;
    },

    getActionLabel(type) {
      const found = this.nodeTypes.actions?.find(a => a.type === type);
      return found?.label || type;
    },

    // Drag & Drop
    onDragStart(event, kind, typeDef) {
      event.dataTransfer.setData('application/json', JSON.stringify({ kind, typeDef }));
      event.dataTransfer.effectAllowed = 'move';
    },

    onDrop(event) {
      const raw = event.dataTransfer.getData('application/json');
      if (!raw) return;
      const { kind, typeDef } = JSON.parse(raw);

      const bounds = this.$refs.vueFlowRef?.$el?.getBoundingClientRect();
      const position = {
        x: event.clientX - (bounds?.left || 0) - 80,
        y: event.clientY - (bounds?.top || 0) - 24
      };

      if (kind === 'trigger') {
        const nodeId = `trg_${uid('t')}`;
        this.nodes.push({
          id: nodeId,
          type: 'trigger',
          position,
          data: {
            id: `t_${uid('t')}`,
            type: typeDef.type,
            label: typeDef.label,
            params: typeDef.type === 'cron'
              ? { interval: 60, cron: null }
              : typeDef.type === 'webhook'
                ? { path: '' }
                : typeDef.type === 'device_event'
                  ? { event: '' }
                  : {}
          },
          style: { background: TRIGGER_COLORS[typeDef.type] || '#3b82f6' }
        });
      } else if (kind === 'action') {
        const nodeId = `act_${uid('a')}`;
        this.nodes.push({
          id: nodeId,
          type: 'action',
          position,
          data: {
            id: `a_${uid('a')}`,
            type: typeDef.type,
            label: typeDef.label,
            params: typeDef.type === 'fetch'
              ? { url: '', method: 'GET', body: '', save: '' }
              : typeDef.type === 'update_page' || typeDef.type === 'switch_page'
                ? { page: '' }
                : typeDef.type === 'patch_section'
                  ? { page: '', sectionId: '', bind: '' }
                  : typeDef.type === 'play_audio'
                    ? { preset: 'notification', text: '' }
                    : typeDef.type === 'tts'
                      ? { text: '' }
                      : typeDef.type === 'control'
                        ? { command: '', value: '' }
                        : {}
          },
          style: { background: ACTION_COLORS[typeDef.type] || '#10b981' }
        });
      }
    },

    onConnect(connection) {
      this.edges.push({
        id: `e_${connection.source}_${connection.target}`,
        source: connection.source,
        target: connection.target,
        animated: true
      });
    },

    onNodeClick({ node }) {
      this.selectedNode = node;
    },

    onNodesChange() {
      // Keep vue-flow reactive
    },

    onNodeDataChange() {
      // Force reactivity
      this.nodes = [...this.nodes];
    },

    deleteSelectedNode() {
      if (!this.selectedNode) return;
      const nodeId = this.selectedNode.id;
      this.nodes = this.nodes.filter(n => n.id !== nodeId);
      this.edges = this.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
      this.selectedNode = null;
    },

    // Pages
    openPagesDialog() {
      if (this.pages.length === 0) {
        this.pages.push({
          id: 'main',
          layout: 'vertical_scroll',
          autoScroll: false,
          autoScrollMs: 0,
          sections: []
        });
        this.pagesTab = 'main';
      }
      this.dialogs.pages = true;
    },

    addPage() {
      const newPage = {
        id: `page_${this.pages.length + 1}`,
        layout: 'vertical_scroll',
        autoScroll: false,
        autoScrollMs: 0,
        sections: []
      };
      this.pages.push(newPage);
      this.pagesTab = newPage.id;
    },

    removePage() {
      if (this.pages.length <= 1) {
        ElMessage.warning('至少保留一个页面');
        return;
      }
      const idx = this.pages.findIndex(p => p.id === this.pagesTab);
      if (idx >= 0) {
        this.pages.splice(idx, 1);
        this.pagesTab = this.pages[0].id;
      }
    },

    addSection(page) {
      const firstType = this.nodeTypes.sectionTypes?.[0];
      const fields = firstType?.fields || [];
      const bind = {};
      fields.forEach(f => {
        bind[f] = '';
      });
      page.sections.push({
        id: `sec_${page.sections.length + 1}`,
        type: firstType?.type || 'hero_section',
        bind
      });
      this.syncPages();
    },

    removeSection(page, index) {
      page.sections.splice(index, 1);
      this.syncPages();
    },

    onSectionTypeChange(section) {
      const st = this.nodeTypes.sectionTypes?.find(s => s.type === section.type);
      const fields = st?.fields || [];
      const newBind = {};
      fields.forEach(f => {
        newBind[f] = section.bind?.[f] || '';
      });
      section.bind = newBind;
      this.syncPages();
    },

    syncPages() {
      this.pages = [...this.pages];
    },

    // Save
    async handleSave() {
      if (!this.workflowName.trim()) {
        ElMessage.warning('工作流名称不能为空');
        return;
      }

      const isCreate = !this.workflowId;
      if (isCreate && !this.workflowIdInput.trim()) {
        ElMessage.warning('请输入工作流 ID');
        return;
      }
      if (isCreate && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(this.workflowIdInput.trim())) {
        ElMessage.warning('ID 格式不正确（英文+下划线）');
        return;
      }

      const finalId = isCreate ? this.workflowIdInput.trim() : this.workflowId;
      const def = this.buildDefinitionJson();
      def.id = finalId;
      def.name = this.workflowName.trim();
      def.icon = this.workflowIcon.trim() || undefined;

      this.loading.save = true;
      try {
        const payload = {
          id: finalId,
          name: this.workflowName.trim(),
          icon: this.workflowIcon.trim() || undefined,
          definitionJson: JSON.stringify(def)
        };

        if (isCreate) {
          await createWorkflowDefinition(payload);
          ElMessage.success('工作流已创建');
          this.workflowId = finalId;
          this.$router.replace({ path: `/sdui/editor/${finalId}` });
        } else {
          await updateWorkflowDefinition(finalId, payload);
          ElMessage.success('保存成功');
        }
      } catch (err) {
        const msg = err?.response?.data?.message || '保存失败';
        ElMessage.error(msg);
      } finally {
        this.loading.save = false;
      }
    },

    goBack() {
      this.$router.push({ path: '/sdui/workflows' });
    }
  }
};
</script>

<style scoped>
.editor-shell {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 86px);
  margin: -20px;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  z-index: 10;
}

.toolbar-name-input {
  width: 200px;
}

.toolbar-icon-input {
  width: 120px;
}

.toolbar-id-input {
  width: 220px;
}

.toolbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.wf-id {
  color: #909399;
  font-size: 12px;
}

.editor-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.left-panel {
  width: 200px;
  min-width: 200px;
  background: #fafafa;
  border-right: 1px solid #e4e7ed;
  overflow-y: auto;
  padding: 12px;
}

.panel-section {
  margin-bottom: 16px;
}

.panel-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
  color: #303133;
}

.panel-hint {
  color: #909399;
  font-size: 13px;
  text-align: center;
  margin-top: 40px;
}

.dnd-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 6px;
  border-radius: 6px;
  background: #fff;
  border: 1px solid #e4e7ed;
  cursor: grab;
  transition: box-shadow 0.15s;
}

.dnd-item:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.dnd-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  flex-shrink: 0;
}

.trigger-dot { background: #3b82f6; }
.action-dot { background: #10b981; }

.dnd-label {
  font-size: 13px;
  font-weight: 500;
}

.dnd-type {
  font-size: 11px;
  color: #909399;
}

.canvas-area {
  flex: 1;
  background: #f5f5f5;
}

.right-panel {
  width: 260px;
  min-width: 260px;
  background: #fff;
  border-left: 1px solid #e4e7ed;
  overflow-y: auto;
  padding: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-weight: 600;
}

.bind-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.bind-field {
  font-size: 12px;
  color: #606266;
  min-width: 60px;
  text-align: right;
}
</style>

<style>
/* Global styles for vue-flow custom nodes */
.flow-node {
  border-radius: 8px;
  padding: 10px 16px;
  color: #fff;
  font-size: 13px;
  min-width: 120px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  border: 2px solid transparent;
  transition: border-color 0.15s;
}

.flow-node.selected {
  border-color: #1d4ed8;
}

.node-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.node-icon {
  font-size: 16px;
}

.node-label {
  font-weight: 500;
  white-space: nowrap;
}

.vue-flow__handle {
  width: 10px;
  height: 10px;
}
</style>
