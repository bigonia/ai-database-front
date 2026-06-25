<template>
  <el-drawer
    :model-value="!!node"
    title="节点配置"
    direction="rtl"
    size="380px"
    @close="$emit('close')"
  >
    <template v-if="node">
      <div class="config-section">
        <h4>基本信息</h4>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="节点 ID">
            {{ node.nodeId }}
          </el-descriptions-item>
          <el-descriptions-item label="节点类型">
            {{ node.nodeType }}
          </el-descriptions-item>
          <el-descriptions-item label="显示名">
            {{ capabilityDef?.displayName || node.nodeType }}
          </el-descriptions-item>
          <el-descriptions-item label="运行模式">
            <el-tag size="small" :color="modeColor" style="color: #fff">
              {{ modeLabel }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="所属槽位">
            {{ node.slotId }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div v-if="capabilityDef?.parameters?.length" class="config-section">
        <h4>参数配置</h4>
        <el-form label-position="top" size="small">
          <el-form-item
            v-for="(param, idx) in capabilityDef.parameters"
            :key="idx"
            :label="(param.displayName as string) || (param.label as string) || (param.name as string)"
            :required="Boolean(param.required)"
          >
            <el-input
              v-if="param.type === 'string' || !param.type"
              :model-value="getParamValue(param)"
              @update:model-value="(val) => setParamValue(param, val)"
              :placeholder="(param.description as string) || ''"
            />
            <el-input-number
              v-else-if="['number', 'integer', 'int', 'float'].includes(String(param.type))"
              :model-value="Number(getParamValue(param) || 0)"
              :min="numberConstraint(param, 'min')"
              :max="numberConstraint(param, 'max')"
              @update:model-value="(val) => setParamValue(param, val)"
            />
            <el-select
              v-else-if="param.type === 'boolean' || param.type === 'bool'"
              :model-value="getParamValue(param)"
              @update:model-value="(val) => setParamValue(param, val)"
            >
              <el-option label="是" :value="true" />
              <el-option label="否" :value="false" />
            </el-select>
            <el-select
              v-else-if="param.type === 'enum'"
              :model-value="getParamValue(param)"
              @update:model-value="(val) => setParamValue(param, val)"
            >
              <el-option
                v-for="option in parameterOptions(param)"
                :key="String(option.value)"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <el-input
              v-else
              :model-value="getParamValue(param)"
              @update:model-value="(val) => setParamValue(param, val)"
              :placeholder="(param.description as string) || ''"
            />
          </el-form-item>
        </el-form>
      </div>

      <div v-else class="config-section">
        <el-empty description="该节点无可配置参数" :image-size="40" />
      </div>

      <div v-if="node.nodeType === 'button.trigger'" class="config-section">
        <h4>触发事件</h4>
        <el-form label-position="top" size="small">
          <el-form-item label="事件">
            <el-select
              :model-value="String(node.params.eventId || '')"
              placeholder="选择按钮事件"
              style="width: 100%"
              @change="setDirectParam('eventId', $event)"
            >
              <el-option
                v-for="event in triggerEvents"
                :key="event.eventId"
                :label="event.displayName || event.eventId"
                :value="event.eventId"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="按钮实例">
            <el-input
              :model-value="String(node.params.nodeId || capabilityDef?.instanceId || '')"
              @update:model-value="setDirectParam('nodeId', $event)"
            />
          </el-form-item>
        </el-form>
      </div>

      <div v-if="node.nodeType === 'section.trigger'" class="config-section">
        <h4>Section 触发事件</h4>
        <el-form label-position="top" size="small">
          <el-form-item label="交互事件">
            <el-select
              :model-value="String(node.params.eventId || '')"
              placeholder="选择 section 交互事件"
              style="width: 100%"
              filterable
              @change="setDirectParam('eventId', $event)"
            >
              <el-option-group
                v-if="capDefEvents.length"
                label="能力节点事件"
              >
                <el-option
                  v-for="event in capDefEvents"
                  :key="event.eventId"
                  :label="`${event.eventId}${event.description ? ' — ' + event.description : ''}`"
                  :value="event.eventId"
                />
              </el-option-group>
              <el-option-group
                v-if="boardEvents.length"
                label="板卡事件目录"
              >
                <el-option
                  v-for="event in boardEvents"
                  :key="event.eventId"
                  :label="`${event.eventId}${event.displayName ? ' — ' + event.displayName : ''}`"
                  :value="event.eventId"
                />
              </el-option-group>
            </el-select>
          </el-form-item>
          <el-form-item label="Section ID">
            <el-input
              :model-value="String(node.params.sectionId || '')"
              placeholder="可选，留空匹配任意同类 section"
              @update:model-value="setDirectParam('sectionId', $event)"
            />
            <div class="param-hint">留空则匹配任意同类 section；填写则仅匹配指定 sectionId</div>
          </el-form-item>
          <el-form-item label="节点 ID (nodeId)">
            <el-input
              :model-value="String(node.params.nodeId || '')"
              placeholder="可选，留空通配"
              @update:model-value="setDirectParam('nodeId', $event)"
            />
            <div class="param-hint">可选，留空则通配该 section 内任意节点</div>
          </el-form-item>
        </el-form>
      </div>

      <div v-if="node.nodeType === 'ui.update'" class="config-section">
        <h4>UI 模板变量</h4>
        <el-form label-position="top" size="small">
          <el-form-item label="模板">
            <el-select
              :model-value="String(node.params.templateKey || '')"
              placeholder="选择已绑定模板"
              style="width: 100%"
              @change="selectUiTemplate"
            >
              <el-option
                v-for="template in availableUiTemplates"
                :key="template.templateKey"
                :label="template.name || template.templateKey"
                :value="template.templateKey"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="模板变量">
            <el-select
              :model-value="String(node.params.variableKey || '')"
              placeholder="选择变量"
              style="width: 100%"
              @change="setDirectParam('variableKey', $event)"
            >
              <el-option
                v-for="variable in selectedTemplateVariables"
                :key="variable.variableKey"
                :label="`${variable.variableKey} · ${variable.sectionId}.${variable.field}`"
                :value="variable.variableKey"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="更新值">
            <el-input
              :model-value="String(node.params.value ?? '')"
              placeholder="支持 $event、$nodes 等上下文引用"
              @update:model-value="setDirectParam('value', $event)"
            />
          </el-form-item>
        </el-form>
      </div>

      <div v-if="capabilityDef?.inputPorts?.length" class="config-section">
        <h4>输入端口</h4>
        <div
          v-for="port in capabilityDef.inputPorts"
          :key="port.id"
          class="port-row"
        >
          <span class="port-name">{{ port.displayName }}</span>
          <el-tag size="small" :type="port.required ? 'danger' : 'info'">
            {{ port.required ? '必填' : '可选' }}
          </el-tag>
        </div>
      </div>

      <div v-if="capabilityDef?.outputPorts?.length" class="config-section">
        <h4>输出端口</h4>
        <div
          v-for="port in capabilityDef.outputPorts"
          :key="port.id"
          class="port-row"
        >
          <span class="port-name">{{ port.displayName }}</span>
          <span class="port-type">{{ port.type }}</span>
        </div>
      </div>
    </template>

    <template #footer>
      <el-button @click="$emit('close')">关闭</el-button>
      <el-button type="danger" plain @click="$emit('remove', node!.nodeId)">
        删除节点
      </el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  node: NodeWorkflowNode | null;
  capabilityDef: CapabilityNodeDefinition | null;
  uiTemplates: Array<{
    templateKey: string;
    name: string;
    variables: Array<{ variableKey: string; sectionId: string; field: string }>;
  }>;
  uiBindings: Array<Record<string, unknown>>;
  boardEvents?: Array<{ eventId: string; displayName?: string; description?: string }>;
}>();

const emit = defineEmits<{
  close: [];
  remove: [nodeId: string];
  updateParams: [nodeId: string, params: Record<string, unknown>];
}>();

const modeColor = computed(() => {
  const mode = String(props.capabilityDef?.runtimeMode || 'ACTION').toUpperCase();
  const colors: Record<string, string> = {
    TRIGGER: '#52c41a',
    ACTION: '#1677ff',
    SESSION: '#fa8c16',
    UI_PATCH: '#722ed1'
  };
  return colors[mode] || '#8c8c8c';
});

const modeLabel = computed(() => {
  const mode = String(props.capabilityDef?.runtimeMode || '').toUpperCase();
  const labels: Record<string, string> = {
    TRIGGER: '触发',
    ACTION: '动作',
    SESSION: '会话',
    UI_PATCH: 'UI 更新'
  };
  return labels[mode] || mode;
});

function getParamValue(param: Record<string, unknown>): unknown {
  const name = param.name as string;
  return props.node?.params?.[name] ?? param.default ?? param.defaultValue ?? '';
}

function setParamValue(param: Record<string, unknown>, value: unknown) {
  if (!props.node) return;
  const name = param.name as string;
  setDirectParam(name, value);
}

function setDirectParam(name: string, value: unknown) {
  if (!props.node) return;
  emit('updateParams', props.node.nodeId, { ...props.node.params, [name]: value });
}

function numberConstraint(param: Record<string, unknown>, name: 'min' | 'max') {
  const constraints = param.constraints as Record<string, unknown> | undefined;
  const value = constraints?.[name] ?? param[name];
  return typeof value === 'number' ? value : undefined;
}

function parameterOptions(param: Record<string, unknown>) {
  const raw = Array.isArray(param.values) ? param.values : Array.isArray(param.options) ? param.options : [];
  return raw.map((item) => {
    if (typeof item === 'object' && item !== null) {
      const record = item as Record<string, unknown>;
      return {
        value: record.value,
        label: String(record.displayName || record.label || record.value || '')
      };
    }
    return { value: item, label: String(item) };
  });
}

const triggerEvents = computed(() => {
  const source = props.capabilityDef?.source as Record<string, unknown> | undefined;
  const events = source?.events;
  return Array.isArray(events)
    ? events.map((item) => item as { eventId: string; displayName?: string })
    : [];
});

/** section.trigger 的能力定义事件 */
const capDefEvents = computed(() => {
  if (props.node?.nodeType !== 'section.trigger') return [];
  const source = props.capabilityDef?.source as Record<string, unknown> | undefined;
  const events = source?.events || source?.sectionEvents;
  return Array.isArray(events)
    ? events.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        eventId: String(record.eventId || record.id || ''),
        displayName: String(record.displayName || record.label || ''),
        description: String(record.description || '')
      };
    })
    : [];
});

const availableUiTemplates = computed(() => {
  if (!props.node) return [];
  const boundKeys = new Set(
    props.uiBindings
      .filter((item) => String(item.slotId || '') === props.node?.slotId)
      .map((item) => String(item.templateKey || ''))
  );
  return props.uiTemplates.filter((item) => boundKeys.has(item.templateKey));
});

const selectedTemplateVariables = computed(() => {
  const key = String(props.node?.params.templateKey || '');
  return props.uiTemplates.find((item) => item.templateKey === key)?.variables || [];
});

function selectUiTemplate(templateKey: unknown) {
  if (!props.node) return;
  const template = props.uiTemplates.find((item) => item.templateKey === String(templateKey));
  emit('updateParams', props.node.nodeId, {
    ...props.node.params,
    slotId: props.node.slotId,
    templateKey,
    variableKey: template?.variables[0]?.variableKey || ''
  });
}
</script>

<style scoped>
.config-section {
  margin-bottom: 20px;
}

.config-section h4 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #122033;
}

.port-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 13px;
}

.port-name {
  color: #122033;
}

.port-type {
  font-size: 11px;
  color: #8c8c8c;
  font-family: Menlo, Monaco, Consolas, monospace;
}

.param-hint {
  margin-top: 4px;
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.4;
}
</style>
