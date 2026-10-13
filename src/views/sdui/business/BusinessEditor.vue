<template>
  <div class="app-container business-editor" v-loading="loading">
    <header class="editor-topbar">
      <div class="business-title"><el-breadcrumb separator="/"><el-breadcrumb-item :to="{ name: 'SduiBusinesses' }">业务</el-breadcrumb-item><el-breadcrumb-item>{{ definition?.name || businessId }}</el-breadcrumb-item></el-breadcrumb><el-input v-if="definition" v-model="definition.name" class="business-name-input" maxlength="80" aria-label="业务名称" @input="markDirty"/><div class="draft-status"><el-tag size="small" :type="dirty ? 'warning' : 'success'">{{ dirty ? '有未保存修改' : '已保存' }}</el-tag><span>保存后需重新部署才会生效</span></div></div>
      <div class="heading-actions"><el-popover v-model:visible="settingsVisible" trigger="click" width="420" placement="bottom-end"><template #reference><el-button>业务设置</el-button></template><el-form v-if="definition" label-position="top"><el-form-item label="用途说明" data-validation-path="description"><el-input v-model="definition.description" type="textarea" :rows="3" maxlength="300" @input="markDirty"/></el-form-item><el-form-item label="设备形态" data-validation-path="devices.local"><el-switch v-model="hasTarget" :data-validation-path="hasTarget ? 'devices.target' : 'devices.local'" active-text="本机 + 目标设备" inactive-text="仅本机" @change="updateTarget"/></el-form-item><el-form-item label="镜像配置" data-validation-path="mirror"><div class="mirror-control"><el-switch v-model="definition.mirror" active-text="启用" inactive-text="关闭" @change="markDirty"/><el-button size="small" :disabled="!hasTarget || mirrorGenerating" :loading="mirrorGenerating" @click="generateMirror">生成镜像配置</el-button></div></el-form-item></el-form><el-alert v-if="targetBlockNotice && targetReassignmentItems.length" class="slot-reassignment-alert" type="warning" :closable="false" title="这些配置仍指向目标设备；调整后再关闭目标槽位。"><template #default><el-space wrap><el-button v-for="item in targetReassignmentItems" :key="item.path" link type="primary" @click="focusLocation(item.path)">{{ item.label }}</el-button></el-space></template></el-alert></el-popover><el-button @click="showResources = !showResources">资源 {{ definition?.uis.length || 0 }} 个界面 · {{ draftResources.length }} 个环节资源</el-button><el-button :disabled="saving" :loading="validating" @click="validate">校验</el-button><el-button type="primary" :disabled="!dirty || deploymentLoading" :loading="saving" @click="saveMetadata">保存</el-button><el-button type="success" :disabled="deploymentLoading || saving" @click="openDeploymentWizard">部署</el-button></div>
    </header>

    <el-alert v-if="loadError" type="error" :closable="false" :title="loadError" />
    <div v-if="catalogError" class="catalog-error"><el-alert type="warning" :closable="false" :title="catalogError" /><el-button size="small" :loading="catalogLoading" @click="loadReferenceData">重新加载目录</el-button></div>
        <el-alert v-if="deploymentNotice" class="deployment-notice" :type="deploymentNotice.type" :closable="true" :title="deploymentNotice.message" @close="deploymentNotice = null" />
    <el-drawer v-model="showResources" title="资源管理" size="min(920px, 92vw)" v-loading="resourcesLoading">
      <template #header><div class="resource-drawer-header"><strong>资源管理</strong><div><el-button size="small" :loading="resourcesLoading" @click="refreshResources()">刷新</el-button><el-button size="small" type="primary" plain :disabled="uiCreating || !Object.keys(sections).length" :loading="uiCreating" @click="addUi">添加界面</el-button></div></div></template>
      <el-alert v-if="dirty" type="info" :closable="false" title="界面编辑直接修改当前草稿；保存业务后更新资源清单；环节资源列表实时反映当前草稿。" />
      <el-alert v-if="resourcesError" type="error" :closable="false" :title="resourcesError" />
      <section class="section-heading"><div><h2>界面资源</h2><p>第一项是初始界面；业务可以不配置界面，环节也可以不显示界面。</p></div></section>
    <el-empty v-if="!definition?.uis?.length" description="还没有界面资源" :image-size="60" />
    <div v-else class="resource-grid">
    <el-card v-for="(ui, index) in definition.uis" :key="String(ui.key)" shadow="never" :data-validation-path="`uis[${index}]`">
        <div class="resource-title"><div><el-input :model-value="ui.key" aria-label="页面名称" @change="renameUi(ui, $event)"/><el-tag v-if="index === 0" size="small" type="success">初始界面</el-tag></div><div><el-button link :disabled="index === 0" @click="moveUi(index, -1)">上移</el-button><el-button link :disabled="index === definition.uis.length - 1" @click="moveUi(index, 1)">下移</el-button><el-button link type="danger" @click="removeUi(String(ui.key))">删除</el-button></div></div>
        <div class="ui-settings"><el-select :model-value="ui.template" :data-validation-path="`uis[${index}].template`" @change="changeTemplate(ui, $event)"><el-option v-for="(template, key) in sections" :key="key" :label="template.displayName || key" :value="key"/></el-select><el-select v-model="ui.owner" :data-validation-path="`uis[${index}].owner`" @change="markDirty"><el-option label="本机" value="local"/><el-option v-if="hasTarget" label="对端" value="target"/></el-select></div>
        <el-alert v-if="!sections[ui.template]" type="warning" :closable="false" :title="`当前模板“${ui.template}”不在已加载目录中，字段定义无法编辑；刷新模板目录或修正模板类型。`" />
        <ChartSectionEditor v-if="isChartSection(ui.template)" :type="ui.template" :fields="ui.fields" @change="ui.fields = $event; markDirty()"/>
        <div v-for="field in (isChartSection(ui.template) ? [] : fieldsFor(ui.template).filter(item => item.type === 'array'))" :key="`array-${field.name}`" class="array-field" :data-validation-path="`uis[${index}].fields.${field.name}`">
          <div class="array-header"><strong>{{ field.label || field.name }}</strong><small>{{ arrayBoundsLabel(ui.template, field.name) }}</small><el-button size="small" :disabled="(ui.fields[field.name] as any[])?.length >= arrayBounds(ui.template, field.name).max" @click="addUiArrayItem(ui, field)">添加项目</el-button></div>
          <el-alert :title="field.description || '按模板限制配置项目数量'" type="info" :closable="false"/>
          <div v-for="(item, itemIndex) in (ui.fields[field.name] as any[]) || []" :key="itemIndex" class="array-item" :data-validation-path="`uis[${index}].fields.${field.name}[${itemIndex}]`">
            <label v-for="child in field.children || []" :key="child.name">{{ ui.template === 'menu_section' && child.name === 'token' ? '确认后的动作' : child.label || child.name }}<el-select v-if="ui.template === 'menu_section' && child.name === 'token'" :model-value="item.token" placeholder="选择动作环节" @change="bindMenuAction(ui, itemIndex, $event)"><el-option label="新建动作环节" value="__create__"/><el-option v-for="flow in menuActionFlows(ui, itemIndex)" :key="flow.key" :label="flow.key" :value="`@${flow.key}`"/></el-select><el-input v-else-if="['text','string','url','color'].includes(child.type)" v-model="item[child.name]" :data-validation-path="`uis[${index}].fields.${field.name}[${itemIndex}].${child.name}`" :placeholder="child.description || ''" @input="markDirty"/><el-input-number v-else-if="['number','integer','int','float'].includes(child.type)" v-model="item[child.name]" :data-validation-path="`uis[${index}].fields.${field.name}[${itemIndex}].${child.name}`" :min="child.min" :max="child.max" @change="markDirty"/><el-switch v-else-if="child.type === 'boolean'" v-model="item[child.name]" :data-validation-path="`uis[${index}].fields.${field.name}[${itemIndex}].${child.name}`" @change="markDirty"/><el-select v-else-if="child.options?.length" v-model="item[child.name]" :data-validation-path="`uis[${index}].fields.${field.name}[${itemIndex}].${child.name}`" clearable @change="markDirty"><el-option v-for="option in child.options" :key="option" :label="option" :value="option"/></el-select><el-input v-else v-model="item[child.name]" :data-validation-path="`uis[${index}].fields.${field.name}[${itemIndex}].${child.name}`" :placeholder="child.description || `类型 ${child.type}`" @input="markDirty"/><small v-if="['text','string','url','color'].includes(child.type) && (child.min != null || child.max != null)" :class="{ 'limit-exceeded': isOutsideLengthBounds(item[child.name], child.min, child.max) }">{{ byteLengthHint(item[child.name], child.min, child.max) }}</small></label>
            <el-input-number v-if="!field.children?.length" v-model="ui.fields[field.name][itemIndex]" :data-validation-path="`uis[${index}].fields.${field.name}[${itemIndex}]`" :min="sections[ui.template]?.constraints?.point_min" :max="sections[ui.template]?.constraints?.point_max" @change="markDirty"/>
            <el-button link type="danger" :disabled="(ui.fields[field.name] as any[])?.length <= arrayBounds(ui.template, field.name).min" @click="removeUiArrayItem(ui, field.name, itemIndex)">删除</el-button>
          </div>
        </div>
        <div v-for="field in (isChartSection(ui.template) ? [] : fieldsFor(ui.template))" :key="field.name" class="ui-field">
          <label>{{ field.label || field.name }}<span v-if="field.required"> *</span></label>
          <template v-if="field.type !== 'array'">
          <el-input v-if="['text','string','url','color'].includes(field.type)" v-model="ui.fields[field.name]" :data-validation-path="`uis[${index}].fields.${field.name}`" :placeholder="field.description || ''" @input="markDirty" />
          <el-input-number v-else-if="['number','integer','int','float'].includes(field.type)" v-model="ui.fields[field.name]" :data-validation-path="`uis[${index}].fields.${field.name}`" :min="field.min" :max="field.max" @change="markDirty" />
          <el-switch v-else-if="field.type === 'boolean'" v-model="ui.fields[field.name]" :data-validation-path="`uis[${index}].fields.${field.name}`" @change="markDirty" />
          <el-select v-else-if="field.options?.length" v-model="ui.fields[field.name]" clearable :data-validation-path="`uis[${index}].fields.${field.name}`" @change="markDirty"><el-option v-for="option in field.options" :key="option" :label="option" :value="option" /></el-select>
          <el-input v-else-if="field.type === 'object'" type="textarea" :rows="5" spellcheck="false" :model-value="uiStructuredDraft(ui, field.name, ui.fields[field.name], field.type)" :data-validation-path="`uis[${index}].fields.${field.name}`" placeholder="JSON 对象" @input="setUiStructuredField(ui, ui.fields, field.name, field.name, field.type, $event)" />
          <el-input v-else v-model="ui.fields[field.name]" :data-validation-path="`uis[${index}].fields.${field.name}`" :placeholder="field.description || '按目录字段类型填写'" @input="markDirty" />
          <small v-if="uiStructuredErrors[uiStructuredKey(ui, field.name)]" class="limit-exceeded">{{ uiStructuredErrors[uiStructuredKey(ui, field.name)] }}</small>
          <small v-if="(field.min != null || field.max != null) && ['text','string','url','color'].includes(field.type)" :class="{ 'limit-exceeded': isOutsideLengthBounds(ui.fields[field.name], field.min, field.max) }">{{ field.description ? `${field.description} · ` : '' }}{{ byteLengthHint(ui.fields[field.name], field.min, field.max) }}</small>
          <small v-else-if="field.description">{{ field.description }}</small>
          </template>
        </div>
      </el-card>
    </div>
      <section class="section-heading"><div><h2>环节资源</h2><p>资源由环节输入和步骤产出自动登记，保留最新结果，可跨环节和设备引用。</p></div></section>
      <el-select v-model="resourceFlowFilter" clearable placeholder="全部环节"><el-option v-for="flow in definition?.flows || []" :key="flow.key" :label="flow.key" :value="flow.key"/></el-select>
      <el-table :data="draftResources.filter(resource => !resourceFlowFilter || resource.flowKey === resourceFlowFilter)" size="small" empty-text="还没有资源；配置采集或处理步骤后会自动登记">
        <el-table-column label="资源名称" min-width="160"><template #default="{ row }"><el-input :model-value="row.name" @change="renameResource(row, $event)"/></template></el-table-column>
        <el-table-column prop="type" label="类型" width="90"/><el-table-column prop="flowKey" label="所属环节" width="120"/>
        <el-table-column prop="origin" label="产生位置" min-width="160"/><el-table-column label="生命周期" width="130"><template #default>持续保留最新结果</template></el-table-column>
      </el-table>
    </el-drawer>
    <el-dialog v-model="deploymentVisible" title="部署业务" width="680px" destroy-on-close :close-on-click-modal="false" :close-on-press-escape="false" :show-close="!deploymentLoading">
      <el-alert type="info" :closable="false" title="选择设备后直接部署。离线设备等待上线后自动恢复；部署进度和执行记录可在详情中查看。" />
      <el-alert v-if="deploymentNotice" class="deployment-notice" :type="deploymentNotice.type" :closable="false" :title="deploymentNotice.message" />
      <el-alert v-if="deploymentValidation && !deploymentValidation.ok" type="error" :closable="false" :title="`${deploymentValidation.errorCount} 个配置问题需要处理`">
        <ul class="deployment-validation-problems"><li v-for="(problem, index) in deploymentValidation.problems.filter(item => item.severity === 'error')" :key="`${problem.location}-${index}`"><strong>{{ problem.location }}</strong>：{{ problem.fix }}</li></ul>
      </el-alert>
      <el-alert v-if="freezeOutcomeUnknown" type="warning" :closable="false" title="部署请求结果未确认，请到部署列表查看本次记录，避免重复创建。" />
      <el-form label-position="top" class="deployment-form">
      <el-form-item label="本机终端"><el-select v-model="deploymentBindings.localDeviceId" :disabled="Boolean(deploymentId) || deploymentLoading" filterable placeholder="选择设备"><el-option v-for="device in devices" :key="device.deviceId" :label="deviceOptionLabel(device)" :value="device.deviceId"/></el-select></el-form-item>
        <el-form-item v-if="hasTarget" label="对端终端"><el-select v-model="deploymentBindings.targetDeviceId" :disabled="Boolean(deploymentId) || deploymentLoading" filterable placeholder="选择对端"><el-option v-for="device in devices" :key="device.deviceId" :label="deviceOptionLabel(device)" :value="device.deviceId"/></el-select></el-form-item>
      </el-form>
      <el-alert v-if="freezeResult?.credential" class="credential-note" type="warning" :closable="false" title="外部触发凭据"><template #default><div class="credential-value"><code>{{ freezeResult.credential }}</code><el-button size="small" @click="copyFreezeCredential">复制凭据</el-button></div><p>请在安全位置保存；刷新或关闭此页面后平台不会再次返回此凭据。</p></template></el-alert>
      <el-result v-if="installResult" :icon="installResult.failed || installResult.offline ? 'warning' : 'success'" :title="installResult.failed || installResult.offline ? '部署已处理' : '部署完成'" :sub-title="`成功 ${installResult.succeeded} · 等待上线 ${installResult.offline} · 失败 ${installResult.failed}`" />
      <template #footer><el-button :disabled="deploymentLoading" @click="deploymentVisible = false">关闭</el-button><el-button v-if="!deploymentId && !freezeOutcomeUnknown" type="primary" :loading="deploymentLoading" @click="deployCurrent">部署</el-button><el-button v-if="deploymentId || freezeOutcomeUnknown" :disabled="deploymentLoading" type="primary" plain @click="openDeployment">查看部署记录</el-button></template>
    </el-dialog>

    <div v-if="definition" class="business-canvas">
      <div class="flow-column">
        <section class="section-heading flow-section-heading"><div><h2>环节</h2><p>按顺序查看业务环节；续接由平台处理，不需要配置连接关系。</p></div><el-button type="primary" @click="addFlow">新增环节</el-button></section>
        <el-empty v-if="!definition.flows.length" description="新增环节后，配置步骤；需要时再添加界面" :image-size="70" />
        <div v-else class="flow-list" data-validation-path="flows">
          <el-card v-for="(flow, flowIndex) in definition.flows" :key="String(flow.key)" shadow="never" class="flow-card" :class="{ 'flow-card-selected': selectedFlowKey === flow.key }" :data-flow-key="flow.key" :data-validation-path="`flows[${flowIndex}]`" @click="selectFlow(flow, flowIndex)">
            <template #header><div class="flow-header"><div class="flow-heading-main"><span class="flow-index">{{ String(flowIndex + 1).padStart(2, '0') }}</span><strong>{{ flow.key }}</strong><el-tag v-if="flowIndex === 0 && !flow.entry" size="small" type="success">部署时启动</el-tag><el-tag v-else size="small" type="info">{{ flow.entry?.kind === 'external' ? `外部触发 ${flow.entry.name || '未命名'}` : flow.entry?.kind === 'device' ? deviceInteractionLabel(flow) : '待配置触发器' }}</el-tag></div><div class="flow-actions" @click.stop><el-button size="small" text :disabled="!canMoveFlow(flowIndex, -1)" @click="moveFlow(flowIndex, -1)">上移</el-button><el-button size="small" text :disabled="!canMoveFlow(flowIndex, 1)" @click="moveFlow(flowIndex, 1)">下移</el-button><el-button size="small" type="danger" text @click="removeFlow(String(flow.key))">删除</el-button></div></div></template>
            <div class="flow-screen-row" @click.stop><span>{{ flow.entry?.kind === 'device' ? '触发页面' : '显示页面' }}</span><el-select class="flow-screen" :data-validation-path="flowScreenValidationPath(flow, flowIndex)" :model-value="flowScreenValue(flow, flowIndex)" :placeholder="flowScreenPlaceholder(flow, flowIndex)" @change="setFlowScreen(flow, flowIndex, $event)"><el-option v-if="flow.entry?.kind !== 'device' && (flowIndex > 0 || flow.entry || !definition.uis.length)" :label="!flow.entry && flowIndex === 0 ? '不显示初始界面' : '沿用当前界面'" value=""/><el-option v-for="ui in definition.uis" :key="String(ui.key)" :label="screenOptionLabel(ui, flow, flowIndex)" :value="String(ui.key)"/></el-select><el-button size="small" text type="primary" :disabled="uiCreating || !Object.keys(sections).length" @click="addUi(String(flow.key))">新建界面</el-button></div>
            <div class="step-list" data-validation-path="flows">
              <div v-if="flowIndex === 0 && !flow.entry" class="continuation-row">首个环节由平台在部署时启动</div>
              <div v-for="(step, stepIndex) in flow.steps" :key="stepIndex" class="step-summary" :class="{ 'step-summary-selected': selectedFlowKey === flow.key && selectedStepIndex === stepIndex }" :data-validation-path="`flows[${flowIndex}].steps[${stepIndex}]`" @click.stop="selectStep(flow, flowIndex, stepIndex)"><span class="step-number">{{ String(stepIndex + 1).padStart(2, '0') }}</span><span class="step-action">{{ actionLabel(step.action) }}</span><el-tag v-if="isPlatformStep(step)" size="small" effect="plain">平台</el-tag><el-tag v-else size="small" effect="plain">{{ step.target === 'target' ? '目标设备' : '本机' }}</el-tag><small v-if="Object.keys(step.produces || {}).length">{{ Object.entries(step.produces).map(([slot, name]) => `${slot}: ${name}`).join(' · ') }}</small></div>
              <div v-if="flow.steps.length" class="continuation-row">⏎ 交回云端后继续执行（平台自动处理）</div>
              <el-button class="add-step-button" size="small" @click.stop="selectFlow(flow, flowIndex); addStep(String(flow.key))">＋ 添加步骤</el-button>
            </div>
          </el-card>
        </div>
      </div>
      <aside class="detail-column">
        <el-card shadow="never" class="detail-card">
          <template #header><div class="detail-heading"><div><strong>{{ detailTitle }}</strong><small>{{ detailSubtitle }}</small></div><el-tag v-if="selectedFlow" size="small">环节 {{ selectedFlowIndex + 1 }}</el-tag></div></template>
          <el-empty v-if="!definition.flows.length" description="先新增一个环节" :image-size="56" />
          <template v-else-if="selectedFlow">
            <el-form label-position="top" class="detail-form">
              <el-form-item label="环节名称"><el-input :model-value="selectedFlow.key" @change="renameFlowKey(selectedFlow, $event)" /></el-form-item>
              <el-form-item v-if="selectedFlowIndex > 0 || selectedFlow.entry" label="触发器类型"><el-select :model-value="selectedFlow.entry?.kind || ''" placeholder="选择触发方式" @change="setTriggerKind(selectedFlow, $event)"><el-option label="设备交互" value="device"/><el-option label="外部调用" value="external"/></el-select></el-form-item>
              <template v-if="selectedFlow.entry?.kind === 'device'">
                <el-form-item label="设备内部触发" :data-validation-path="`flows[${selectedFlowIndex}].entry.interaction`">
                  <el-select :model-value="selectedFlow.entry.interaction || ''" placeholder="选择按钮按法或菜单项" @change="setDeviceInteraction(selectedFlow, $event)">
                    <el-option v-for="option in deviceInteractionOptions(selectedFlow)" :key="option.value" :label="option.label" :value="option.value" :disabled="option.disabled"/>
                  </el-select>
                </el-form-item>
                <p class="detail-help">只在触发页面显示时生效；触发后按顺序执行下方动作。</p>
                <el-alert v-if="triggerUi(selectedFlow)?.template === 'menu_section'" type="info" :closable="false" title="菜单：加号短按切换选项，电源短按确认。选择菜单项配置确认后的动作；这两个短按不能重复绑定。"/>
                <el-form-item label="添加页面跳转"><el-select :model-value="''" placeholder="选择目标页面，添加显示页面动作" @change="addPageJump(selectedFlow, $event)"><el-option v-for="ui in definition.uis" :key="ui.key" :label="ui.key" :value="ui.key"/></el-select></el-form-item>
              </template>
              <el-form-item v-if="selectedFlow.entry?.kind === 'external'" label="外部触发名称"><el-input v-model="selectedFlow.entry.name" placeholder="例如 say" @change="markDirty"/></el-form-item>
              <el-form-item v-if="selectedFlow.entry?.kind === 'external'" label="传入值"><div class="trigger-values"><div v-for="(valueType, valueName) in selectedFlow.entry.values" :key="valueName" class="trigger-value"><el-input :model-value="valueName" placeholder="值名称" @change="renameTriggerValue(selectedFlow, String(valueName), $event)"/><el-select v-model="selectedFlow.entry.values[valueName]" @change="markDirty"><el-option v-for="type in valueTypes" :key="type" :label="type" :value="type"/></el-select><el-input v-model="selectedFlow.entry.valueDescriptions[valueName]" placeholder="用途说明（可选）" maxlength="160" @input="markDirty"/><el-button link type="danger" @click="removeTriggerValue(selectedFlow, String(valueName))">删除</el-button></div><el-button link type="primary" @click="addTriggerValue(selectedFlow)">添加输入值</el-button><small class="trigger-schema-help">外部调用要求填写全部声明值；用途说明会随部署导出，帮助 Agent 理解参数。</small></div></el-form-item>
              <el-form-item :label="selectedFlow.entry?.kind === 'device' ? '触发页面' : '显示页面'"><el-select :data-validation-path="flowScreenValidationPath(selectedFlow, selectedFlowIndex)" :model-value="flowScreenValue(selectedFlow, selectedFlowIndex)" :placeholder="flowScreenPlaceholder(selectedFlow, selectedFlowIndex)" @change="setFlowScreen(selectedFlow, selectedFlowIndex, $event)"><el-option v-if="selectedFlow.entry?.kind !== 'device' && (selectedFlowIndex > 0 || selectedFlow.entry || !definition.uis.length)" :label="!selectedFlow.entry && selectedFlowIndex === 0 ? '不显示初始界面' : '沿用当前界面'" value=""/><el-option v-for="ui in definition.uis" :key="String(ui.key)" :label="screenOptionLabel(ui, selectedFlow, selectedFlowIndex)" :value="String(ui.key)"/></el-select><el-button link type="primary" :disabled="uiCreating || !Object.keys(sections).length" @click="addUi(String(selectedFlow.key))">新建界面</el-button></el-form-item>
            </el-form>
            <el-divider content-position="left">触发后执行的动作</el-divider>
            <el-empty v-if="selectedStepIndex < 0 || !selectedFlow.steps[selectedStepIndex]" description="选择步骤查看详情，或添加新步骤" :image-size="48" />
            <template v-else-if="selectedStep"><div class="detail-step-title"><span>步骤 {{ selectedStepIndex + 1 }}</span><el-button link type="danger" @click="removeStep(String(selectedFlow.key), selectedStepIndex)">删除步骤</el-button></div><el-form label-position="top" class="detail-form"><el-form-item label="动作" :data-validation-path="`flows[${selectedFlowIndex}].steps[${selectedStepIndex}].action`"><el-select :model-value="selectedStep.action" filterable @change="onStepActionChange(selectedStep, $event)"><el-option v-for="action in businessActions" :key="action.action" :label="actionLabel(action.action)" :value="action.action"><span>{{ actionLabel(action.action) }}</span><small class="option-detail">{{ action.description || action.role }}{{ action.supportLabel ? ` · ${action.supportLabel}` : '' }}</small></el-option></el-select></el-form-item><el-form-item v-if="!isPlatformStep(selectedStep)" label="执行目标" :data-validation-path="`flows[${selectedFlowIndex}].steps[${selectedStepIndex}].target`"><el-select v-model="selectedStep.target" clearable placeholder="本机或目标设备" @change="markDirty"><el-option label="本机" value="local"/><el-option v-if="hasTarget" label="目标设备" value="target"/></el-select></el-form-item><template v-if="selectedStep.action === 'ui.show'"><el-form-item label="界面资源"><el-select :model-value="selectedStep.ui" @change="setUiShowTarget(selectedStep, $event)"><el-option v-for="ui in definition.uis" :key="String(ui.key)" :label="String(ui.key)" :value="ui.key"/></el-select></el-form-item><el-form-item v-for="field in fieldsForUi(selectedStep.ui)" :key="field.name" :label="field.label || field.name" :data-validation-path="`flows[${selectedFlowIndex}].steps[${selectedStepIndex}].bind.${field.name}`">
                <div class="detail-param">
                  <el-button link size="small" @click="toggleUiBindingReference(selectedStep, field.name)">{{ isParamReference(selectedStep.bind[field.name]) ? '直接填写' : '选择资源' }}</el-button>
                  <el-select v-if="isParamReference(selectedStep.bind[field.name])" v-model="selectedStep.bind[field.name]" clearable filterable placeholder="选择业务资源" @change="markDirty"><el-option v-for="resource in availableFlowResources(draftResources,selectedFlow.key,selectedStepIndex)" :key="resource.reference" :label="`${resource.name} · ${resource.type} · ${resource.flowKey}`" :value="resource.reference"/></el-select>
                  <el-input v-else-if="field.type === 'string'" v-model="selectedStep.bind[field.name]" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" placeholder="直接填写文本，留空沿用界面原值" @input="markDirty" @change="clearEmptyUiBinding(selectedStep, field.name)"/>
                  <el-input v-else type="textarea" :model-value="jsonParamValue(selectedStep.bind[field.name])" :placeholder="`JSON ${field.type}`" @change="setUiBindingJson(selectedStep, field.name, $event)"/>
                </div>
              </el-form-item></template><template v-else>
                <template v-if="selectedStep.action === 'audio.play'">
                  <el-form-item label="播放内容"><el-radio-group v-model="playbackSource"><el-radio-button value="text">文字</el-radio-button><el-radio-button value="audio">音频资源</el-radio-button><el-radio-button value="tone">提示音</el-radio-button></el-radio-group></el-form-item>
                </template>
                <template v-if="selectedStep.action === 'audio.record'">
                  <el-form-item label="采集方式"><el-select v-model="selectedStep.with.mode" @change="markDirty"><el-option v-if="selectedFlow.entry?.kind === 'device'" label="再次触发结束录音" value="toggle"/><el-option label="定时结束录音" value="timed"/></el-select></el-form-item>
                  <el-alert type="info" :closable="false" title="结束采集后产生音频和识别文本；再次触发模式会等待下一次相同交互，结束后继续执行后续步骤。"/>
                </template>
                <el-form-item v-for="param in visibleActionParameters(selectedStep)" :key="param.name" :label="actionParameterLabel(param)" :data-validation-path="`flows[${selectedFlowIndex}].steps[${selectedStepIndex}].with.${param.name}`"><div class="detail-param"><el-button v-if="!['audio', 'image', 'series'].includes(param.type)" link size="small" @click="toggleParamReference(selectedStep,param,String(selectedFlow.key))">{{ isParamReference(selectedStep.with[param.name]) ? '直接填写' : '选择资源' }}</el-button><el-select v-if="isParamReference(selectedStep.with[param.name]) || ['audio', 'image', 'series'].includes(param.type)" :model-value="String(selectedStep.with[param.name])" filterable clearable placeholder="选择业务共享资源" @change="setParamReference(selectedStep,param,$event)"><el-option v-for="resource in compatibleValueResources(param,String(selectedFlow.key),selectedStep.action)" :key="`${resource.flowKey}.${resource.name}`" :label="`${resource.name} · ${resource.type} · ${resource.flowKey} · ${resource.origin}`" :value="resource.reference"/></el-select><el-select v-else-if="param.values?.length" v-model="selectedStep.with[param.name]" :placeholder="param.required ? '必填' : '可选'" clearable @change="markDirty"><el-option v-for="value in param.values" :key="String(value)" :label="param.name === 'tone' ? ({short:'短提示音',double:'双提示音',low:'低音提示'}[String(value)] || String(value)) : String(value)" :value="value"/></el-select><el-input-number v-else-if="['int','integer','number','float'].includes(param.type)" :model-value="numericParamValue(selectedStep.with[param.name])" :min="param.min" :max="param.max" :placeholder="param.required ? '必填' : '可选'" @change="setNumericParam(selectedStep,param,$event)"/><el-switch v-else-if="param.type==='boolean'" v-model="selectedStep.with[param.name]" @change="markDirty"/><el-input v-else-if="['object','array','series'].includes(param.type)" type="textarea" :model-value="jsonParamValue(selectedStep.with[param.name])" :placeholder="`JSON ${param.type}`" @change="setJsonParam(selectedStep,param,$event)"/><el-input v-else v-model="selectedStep.with[param.name]" :placeholder="`类型 ${param.type}${param.required ? ' · 必填' : ''}`" @input="markDirty"/><input v-if="['image','series'].includes(param.type)" type="file" accept="image/png,image/jpeg" :multiple="param.type === 'series'" @change="uploadImageParameter(selectedStep,param,$event)"/><small v-if="!isParamReference(selectedStep.with[param.name]) && selectedStep.with[param.name] && ['image','series'].includes(param.type)">已配置 {{ param.type === 'series' ? uploadedFrameCount(selectedStep.with[param.name]) + ' 帧' : '图片' }}</small></div></el-form-item></template><el-form-item v-if="!actionParameters(selectedStep.action).length && selectedStep.action !== 'ui.show'" label="动作参数"><el-input type="textarea" :rows="4" :model-value="jsonValue(selectedStep.with) || '{}'" @change="parseStepParams(selectedStep, $event)"/></el-form-item><el-form-item v-for="(type, slot) in actionOutputs(selectedStep.action)" :key="slot" :label="`资源名称 · ${type}`"><el-input :model-value="resourceDisplayName(selectedStep.produces[slot], selectedFlow.key)" placeholder="资源名称" @change="renameStepResource(selectedFlow,selectedStepIndex,String(slot),$event)"/></el-form-item></el-form></template>
            <el-divider content-position="left">动作目录</el-divider><p class="detail-help">配置期不绑定真机；终端能力将在部署时校验。</p>
          </template>
        </el-card>
      </aside>
    </div>

    <section class="section-heading validation-heading"><div><h2>配置检查</h2><p>问题来自服务端；选择问题可跳转到对应环节或界面。</p></div><el-button :loading="validating" @click="validate">重新检查</el-button></section>
    <el-alert v-if="validationError" type="error" :closable="false" :title="validationError" />
    <el-alert v-if="validation" :type="validation.ok ? 'success' : 'error'" :closable="false" :title="validation.ok ? `配置有效，${validation.warningCount} 条提醒` : `${validation.errorCount} 个问题需要处理`" />
    <el-table v-if="validation?.problems?.length" :data="validation.problems" class="problems-table" :row-key="validationProblemKey">
      <el-table-column label="级别" width="90"><template #default="{ row }"><el-tag :type="row.severity === 'error' ? 'danger' : 'warning'">{{ row.severity === 'error' ? '错误' : '提醒' }}</el-tag></template></el-table-column>
      <el-table-column label="位置" min-width="220"><template #default="{ row }"><el-button link type="primary" @click="focusLocation(row.location)">{{ row.location }}</el-button></template></el-table-column>
      <el-table-column label="问题与修复" min-width="300"><template #default="{ row }"><div>{{ row.fix }}</div><small v-if="row.expected">期望：{{ row.expected }}；实际：{{ row.actual || '未提供' }}</small></template></el-table-column>
      <el-table-column label="操作" width="150"><template #default="{ row }"><el-button v-if="converterTarget(row)" link type="primary" @click="insertSuggestedConverter(row)">插入 {{ row.converter }}</el-button></template></el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import ChartSectionEditor from '../components/ChartSectionEditor.vue';
import { isChartSection, defaultChartFields } from '../components/chartSections';
import { businessActionLabels, isBusinessRecipe, isVisibleBusinessAction } from '@/sdui/capabilityCatalog';
import { collectFlowResources, availableFlowResources, registerStepResources, type FlowResource } from '@/sdui/flowResources';
import { uniqueBusinessName, renamePageReferences, renameMenuActionReferences, removeMenuItemBinding } from '@/sdui/businessInteraction';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { deployBusiness, getActionCatalog, getBusiness, getBusinessResources, getSectionCatalog, installDeployment, listSduiDevices, parseActionCatalog, parseSectionCatalog, parseValidationProjection, saveBusiness, validateBusiness, type ActionCatalogEntry, type ActionParameterDocumentation, type BusinessDefinition, type BusinessEditorResources, type BusinessFlow, type BusinessUiResource, type DeploymentFrozen, type DeploymentOperationResult, type ExternalFlowEntry, type SectionField, type SectionTemplate, type SduiDeviceOption, type ValidationProjection } from '@/api/business';
import { useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const businessId = computed(() => String(route.params.businessId || ''));
const uiStructuredDrafts = reactive<Record<string, string>>({});
const uiStructuredErrors = reactive<Record<string, string>>({});
const FREEZE_UNKNOWN_TTL_MS = 24 * 60 * 60 * 1000;
function freezeUnknownStorageKey(id: string) { return `sdui:freeze-unknown:${id}`; }
function readFreezeOutcomeUnknown(id: string): boolean {
  if (!id || typeof window === 'undefined') return false;
  try {
    const expiresAt = Number(window.sessionStorage.getItem(freezeUnknownStorageKey(id)));
    if (expiresAt > Date.now()) return true;
    window.sessionStorage.removeItem(freezeUnknownStorageKey(id));
  } catch { /* Keep the in-memory warning when browser storage is unavailable. */ }
  return false;
}
function writeFreezeOutcomeUnknown(id: string, unknown: boolean) {
  if (!id || typeof window === 'undefined') return;
  try {
    const key = freezeUnknownStorageKey(id);
    if (unknown) window.sessionStorage.setItem(key, String(Date.now() + FREEZE_UNKNOWN_TTL_MS));
    else window.sessionStorage.removeItem(key);
  } catch { /* The warning remains available for the current page session. */ }
}
const definition = ref<BusinessDefinition | null>(null);
function definitionSnapshot(value: BusinessDefinition): BusinessDefinition {
  return JSON.parse(JSON.stringify(value)) as BusinessDefinition;
}
const revision = ref(0);
const loading = ref(false);
const saving = ref(false);
const validating = ref(false);
const validation = ref<ValidationProjection | null>(null);
const targetBlockNotice = ref(false);
const targetReassignmentItems = computed(() => {
  const current = definition.value;
  if (!current) return [];
  const items: Array<{ label: string; path: string }> = [];
  current.uis.forEach((ui, index) => {
    if (ui.owner === 'target') items.push({ label: `界面 ${ui.key} · 归属`, path: `uis[${index}].owner` });
  });
  current.flows.forEach((flow, flowIndex) => flow.steps.forEach((step, stepIndex) => {
    if (step.target === 'target') {
      items.push({ label: `${flow.key} · 第 ${stepIndex + 1} 步 ${step.action} · 执行位置`,
        path: `flows[${flowIndex}].steps[${stepIndex}].target` });
    }
  }));
  return items;
});
const validationError = ref('');
const hasTarget = ref(false);
const loadError = ref('');
const sections = ref<Record<string, SectionTemplate>>({});
const sectionsLoaded = ref(false);
const catalogLoading = ref(false);
const catalogErrors = ref({ sections: '', actions: '', devices: '' });
const catalogError = computed(() => {
  const errors = [catalogErrors.value.sections, catalogErrors.value.actions, catalogErrors.value.devices].filter(Boolean);
  if (sectionsLoaded.value && !Object.keys(sections.value).length) errors.push('界面模板目录为空，暂时不能新增界面');
  return errors.join('；');
});
const platformActions = ref<ActionCatalogEntry[]>([]);
const valueTypes = ['text', 'number', 'series', 'image', 'audio'];
const actions = ref<Array<ActionCatalogEntry & { supportLabel?: string }>>([]);
const businessActions = computed(() => actions.value.filter(action => isVisibleBusinessAction(action.action)));
const resources = ref<BusinessEditorResources | null>(null);
const draftResources = computed(() => collectFlowResources(definition.value, [...actions.value, ...platformActions.value]));
const resourceFlowFilter = ref('');
function actionLabel(action: string) { return businessActionLabels[action] || action; }
function resourceDisplayName(reference: string | undefined, flowKey: string) {
  const prefix = `@${flowKey}.`;
  return reference?.startsWith(prefix) ? reference.slice(prefix.length) : (reference || '').replace(/^@/, '');
}
function renameResource(resource: FlowResource, raw: string) {
  const flow = definition.value?.flows.find(item => item.key === resource.flowKey);
  if (!flow) return;
  if (resource.fromTrigger) { renameTriggerValue(flow, resource.name, raw); return; }
  renameStepResource(flow, resource.stepIndex, resource.slot, raw);
}
function renameStepResource(flow: BusinessFlow, stepIndex: number, slot: string, raw: string) {
  const name = raw.trim().replace(/^@/, '');
  if (!name || name.includes('.')) { ElMessage.warning('请输入不含点号的资源名称'); return; }
  const step = flow.steps[stepIndex];
  step.produces ||= {};
  const previous = step.produces[slot];
  const next = `@${flow.key}.${name}`;
  if (next === previous) return;
  if (draftResources.value.some(resource => resource.flowKey === flow.key && resource.reference === next)) {
    ElMessage.warning('当前环节已有同名资源'); return;
  }
  step.produces[slot] = next;
  if (previous) definition.value?.flows.flatMap(item => item.steps).forEach(item => {
    item.with = rewriteExactReference(item.with, previous, next) as Record<string, unknown>;
    item.bind = rewriteExactReference(item.bind, previous, next) as Record<string, string>;
  });
  markDirty();
}
function rewriteExactReference(value: unknown, previous: string, next: string): unknown {
  if (value === previous) return next;
  if (Array.isArray(value)) return value.map(item => rewriteExactReference(item, previous, next));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteExactReference(item, previous, next)]));
  return value;
}
function uploadedFrameCount(value: unknown) { return Array.isArray(value) ? value.length : 0; }
function playbackInput(step: BusinessFlow['steps'][number]) {
  return ['audio', 'tone', 'text'].find(name => Object.prototype.hasOwnProperty.call(step.with || {}, name)) || 'text';
}
function setPlaybackInput(step: BusinessFlow['steps'][number], source: string) {
  if (!['text', 'audio', 'tone'].includes(source)) return;
  const parameters = { ...(step.with || {}) };
  for (const key of ['text', 'audio', 'tone']) delete parameters[key];
  parameters[source] = source === 'tone' ? 'short' : source === 'audio' ? '@' : '';
  step.with = parameters;
  markDirty();
}
function visibleActionParameters(step: BusinessFlow['steps'][number]) {
  return actionParameters(step.action).filter(param =>
    (step.action !== 'audio.play' || param.name === playbackInput(step))
    && (step.action !== 'audio.record' || (param.name !== 'mode' && (param.name !== 'duration_ms' || step.with?.mode === 'timed'))));
}
async function uploadImageParameter(step: BusinessFlow['steps'][number], param: ActionParameterDocumentation, event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files || []);
  if (!files.length) return;
  if (files.length > 120 || files.some(file => file.size > 5 * 1024 * 1024)) { ElMessage.error('最多 120 帧，单张图片不超过 5 MB'); return; }
  try {
    const data = await Promise.all(files.map(file => new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
    })));
    if (!definition.value?.flows.some(flow => flow.steps.includes(step))) return;
    step.with ||= {};
    step.with[param.name] = param.type === 'series' ? data : data[0];
    markDirty();
  } catch { ElMessage.error('图片读取失败'); }
}
const resourcesLoading = ref(false);
const resourcesError = ref('');
const showResources = ref(false);
const settingsVisible = ref(false);
const selectedFlowKey = ref('');
const selectedStepIndex = ref(-1);
const selectedFlowIndex = computed(() => {
  const flows = definition.value?.flows || [];
  const index = flows.findIndex(flow => flow.key === selectedFlowKey.value);
  return index >= 0 ? index : flows.length ? 0 : -1;
});
const selectedFlow = computed(() => definition.value?.flows[selectedFlowIndex.value] || null);
type EditorStep = BusinessFlow['steps'][number] & {
  with: Record<string, unknown>; produces: Record<string, string>; bind: Record<string, unknown>;
};
const selectedStep = computed(() => (selectedFlow.value?.steps[selectedStepIndex.value] as EditorStep | undefined) || null);
const playbackSource = computed({
  get: () => selectedStep.value ? playbackInput(selectedStep.value) : 'text',
  set: (source: string) => {
    const step = selectedStep.value;
    if (step?.action === 'audio.play') setPlaybackInput(step, source);
  }
});
const detailTitle = computed(() => selectedStep.value ? '步骤详情' : selectedFlow.value ? '环节详情' : '详情');
const detailSubtitle = computed(() => selectedFlow.value ? `环节 ${selectedFlow.value.key} · ${selectedFlow.value.entry?.kind === 'external' ? '外部调用' : selectedFlow.value.entry?.kind === 'device' ? '设备交互' : '初始 / 续接'}` : '选择环节或步骤进行编辑');
const dirty = ref(false);
const uiCreating = ref(false);
const mirrorGenerating = ref(false);
const deploymentVisible = ref(false);
const deploymentLoading = ref(false);
const deploymentId = ref('');
const devices = ref<any[]>([]);
const deploymentBindings = ref({ localDeviceId: '', targetDeviceId: '' });
const installResult = ref<DeploymentOperationResult | null>(null);
const freezeResult = ref<DeploymentFrozen | null>(null);
const freezeOutcomeUnknown = ref(readFreezeOutcomeUnknown(businessId.value));
const deploymentNotice = ref<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);
const deploymentValidation = ref<ValidationProjection | null>(null);
let businessLoadGeneration = 0;
let businessRouteGeneration = 0;
let resourceRequestGeneration = 0;
let catalogLoadRequestId = 0;
let editRevision = 0;

function dataOf<T>(response: { data?: T } | null | undefined): T | undefined { return response?.data; }
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function parseResources(value: unknown, expectedBusinessId: string): BusinessEditorResources {
  if (!isRecord(value) || value.businessId !== expectedBusinessId || !Array.isArray(value.uis) || !Array.isArray(value.values)) {
    throw new Error('业务资源接口响应结构无效');
  }
  const validUi = value.uis.every((item) => isRecord(item) && typeof item.key === 'string'
    && (item.owner === null || item.owner === 'local' || item.owner === 'target')
    && typeof item.template === 'string' && typeof item.initial === 'boolean'
    && typeof item.origin === 'string' && Array.isArray(item.referencedBy)
    && item.referencedBy.every((reference) => typeof reference === 'string'));
  const validValue = value.values.every((item) => isRecord(item) && typeof item.name === 'string'
    && typeof item.type === 'string' && typeof item.flowKey === 'string'
    && typeof item.origin === 'string' && typeof item.fromTrigger === 'boolean'
    && typeof item.transient === 'boolean');
  if (!validUi || !validValue) throw new Error('业务资源条目结构无效');
  return value as unknown as BusinessEditorResources;
}
function frozenDeviceRoles(value: DeploymentFrozen | null): Map<string, string> {
  const roles = new Map<string, string>();
  if (value?.localDeviceId) roles.set(value.localDeviceId, 'local');
  for (const id of value?.targetDeviceIds || []) roles.set(id, 'target');
  return roles;
}
function isDeploymentFrozen(value: unknown, expectedBusinessId: string,
  expectedBindings: { localDeviceId: string; targetDeviceId?: string }): value is DeploymentFrozen {
  return isRecord(value) && typeof value.deploymentId === 'string' && value.deploymentId.length > 0
    && value.businessId === expectedBusinessId
    && typeof value.localDeviceId === 'string' && value.localDeviceId === expectedBindings.localDeviceId
    && Array.isArray(value.targetDeviceIds)
    && value.targetDeviceIds.length === (expectedBindings.targetDeviceId ? 1 : 0)
    && (!expectedBindings.targetDeviceId || value.targetDeviceIds[0] === expectedBindings.targetDeviceId)
    && (!expectedBindings.targetDeviceId || value.localDeviceId !== expectedBindings.targetDeviceId)
    && Array.isArray(value.triggers) && value.triggers.every((item) => typeof item === 'string' && item.length > 0)
    && typeof value.initialRunDuplicate === 'boolean'
    && (value.initialFlowKey === null || typeof value.initialFlowKey === 'string' || value.initialFlowKey === undefined)
    && (value.initialRunId === null || typeof value.initialRunId === 'string' || value.initialRunId === undefined)
    && (value.credential === null || typeof value.credential === 'string' || value.credential === undefined);
}
function isInstallResult(value: unknown, expectedDeploymentId: string, frozen: DeploymentFrozen | null): value is DeploymentOperationResult {
  if (!isRecord(value) || value.deploymentId !== expectedDeploymentId || !frozen
    || !Number.isInteger(value.offline) || Number(value.offline) < 0
    || !Number.isInteger(value.succeeded) || Number(value.succeeded) < 0
    || !Number.isInteger(value.failed) || Number(value.failed) < 0
    || !Array.isArray(value.devices)) return false;
  const expectedRoles = frozenDeviceRoles(frozen);
  const seen = new Set<string>();
  let succeeded = 0;
  let offline = 0;
  let failed = 0;
  for (const item of value.devices) {
    if (!isRecord(item) || typeof item.deviceId !== 'string' || !expectedRoles.has(item.deviceId)
      || seen.has(item.deviceId) || item.role !== expectedRoles.get(item.deviceId)
      || !['ok', 'failed', 'skipped'].includes(String(item.status))
      || !(item.error === null || typeof item.error === 'string')) return false;
    seen.add(item.deviceId);
    if (item.status === 'ok') succeeded++;
    else if (item.status === 'failed') failed++;
    else offline++;
  }
  return seen.size === expectedRoles.size && succeeded === value.succeeded && offline === value.offline
    && failed === value.failed && succeeded + offline + failed === value.devices.length;
}
function capabilityStateLabel(state: string | null | undefined): string {
  return ({
    READY: '能力已就绪',
    HELLO_PENDING: '等待终端握手',
    SCHEMA_PENDING: '能力 Schema 同步中',
    READY_SENT: '等待终端确认能力',
    FAILED: '能力协商失败'
  } as Record<string, string>)[state || ''] || (state ? `能力状态 ${state}` : '能力状态未知');
}
function deviceOptionLabel(device: SduiDeviceOption): string {
  const online = device.status === 'ONLINE' || device.online === true;
  return `${device.name || device.deviceId} · ${online ? '在线' : '离线'} · ${capabilityStateLabel(device.capabilitySyncState)}`;
}
function parseBusinessPayload(value: unknown, expectedBusinessId: string): { revision: number; definition: BusinessDefinition } {
  if (!isRecord(value) || value.businessId !== expectedBusinessId
    || typeof value.revision !== 'number' || !Number.isInteger(value.revision) || value.revision < 1
    || !isRecord(value.definition)) {
    throw new Error('业务接口响应缺少匹配的业务 ID、有效修订号或定义');
  }
  const definition = value.definition;
  const validStringMap = (candidate: unknown) => isRecord(candidate)
    && Object.values(candidate).every(item => typeof item === 'string');
  const validEntry = (entry: unknown) => {
    if (!isRecord(entry)) return false;
    if (entry.kind === 'device') return (entry.ui == null || typeof entry.ui === 'string')
      && (entry.interaction == null || typeof entry.interaction === 'string');
    return entry.kind === 'external' && (entry.name == null || typeof entry.name === 'string')
      && (entry.values == null || validStringMap(entry.values));
  };
  const validStep = (step: unknown) => isRecord(step)
    && typeof step.action === 'string' && step.action.trim().length > 0
    && (step.target == null || step.target === 'local' || step.target === 'target')
    && (step.with == null || isRecord(step.with))
    && (step.produces == null || validStringMap(step.produces))
    && (step.ui == null || typeof step.ui === 'string')
    && (step.bind == null || validStringMap(step.bind));
  const validUi = (ui: unknown) => isRecord(ui)
    && typeof ui.key === 'string' && ui.key.length > 0
    && (ui.owner === 'local' || ui.owner === 'target')
    && typeof ui.template === 'string' && ui.template.length > 0
    && isRecord(ui.fields);
  const validFlow = (flow: unknown) => isRecord(flow)
    && typeof flow.key === 'string' && flow.key.length > 0
    && (flow.entry == null || validEntry(flow.entry))
    && Array.isArray(flow.steps) && flow.steps.every(validStep);
  const devices = definition.devices;
  if (definition.id !== expectedBusinessId || typeof definition.name !== 'string'
    || typeof definition.description !== 'string'
    || !isRecord(devices) || Object.keys(devices).some(role => role !== 'local' && role !== 'target')
    || Object.values(devices).some(slot => !isRecord(slot) || Object.keys(slot).length > 0)
    || typeof definition.mirror !== 'boolean'
    || !Array.isArray(definition.uis) || !definition.uis.every(validUi)
    || new Set(definition.uis.map(ui => (ui as Record<string, unknown>).key)).size !== definition.uis.length
    || !Array.isArray(definition.flows) || !definition.flows.every(validFlow)
    || new Set(definition.flows.map(flow => (flow as Record<string, unknown>).key)).size !== definition.flows.length) {
    throw new Error('业务定义响应结构无效');
  }
  return { revision: value.revision, definition: definition as unknown as BusinessDefinition };
}
function markDirty() {
  editRevision++;
  dirty.value = true;
  validation.value = null;
  validationError.value = '';
}

async function confirmDiscardDraft(): Promise<boolean> {
  if (deploymentLoading.value) {
    ElMessage.warning('冻结或安装请求正在处理中；为保留服务端回执与一次性凭据，请等待操作完成后再离开');
    return false;
  }
  if (!dirty.value) return true;
  if (saving.value) {
    ElMessage.warning('草稿正在保存，保存完成后再切换页面');
    return false;
  }
  try {
    await ElMessageBox.confirm(
      '当前业务有未保存修改。离开后这些修改将丢失；如需保留，请先保存业务。',
      '放弃未保存修改？',
      { type: 'warning', confirmButtonText: '放弃修改并离开', cancelButtonText: '继续编辑', distinguishCancelAndClose: true }
    );
    return true;
  } catch {
    return false;
  }
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value && !deploymentLoading.value) return;
  event.preventDefault();
  event.returnValue = '';
}

onBeforeRouteLeave(() => confirmDiscardDraft());
onBeforeRouteUpdate((to, from) => {
  if (to.params.businessId === from.params.businessId) return true;
  return confirmDiscardDraft();
});

function canMoveFlow(index: number, direction: -1 | 1): boolean {
  const flows = definition.value?.flows;
  const nextIndex = index + direction;
  return Boolean(flows && nextIndex >= 0 && nextIndex < flows.length
    && flows[index]?.entry && flows[nextIndex]?.entry);
}

function moveFlow(index: number, direction: -1 | 1) {
  if (!canMoveFlow(index, direction) || !definition.value) return;
  const flows = definition.value.flows;
  const nextIndex = index + direction;
  [flows[index], flows[nextIndex]] = [flows[nextIndex], flows[index]];
  markDirty();
}

function moveUi(index: number, direction: -1 | 1) {
  const uis = definition.value?.uis;
  const nextIndex = index + direction;
  if (!uis || nextIndex < 0 || nextIndex >= uis.length) return;
  [uis[index], uis[nextIndex]] = [uis[nextIndex], uis[index]];
  markDirty();
}

function renameFlowKey(flow: BusinessFlow, rawKey: string) {
  const oldKey = flow.key;
  const newKey = rawKey.trim();
  if (!newKey) {
    ElMessage.warning('环节 key 不能为空');
    return;
  }
  if (newKey === oldKey) return;
  if (definition.value?.flows.some(item => item !== flow && item.key === newKey)) {
    ElMessage.warning(`环节 key “${newKey}”已存在`);
    return;
  }

  if (definition.value) renameMenuActionReferences(definition.value, oldKey, newKey);
  flow.key = newKey;
  if (selectedFlowKey.value === oldKey) selectedFlowKey.value = newKey;
  definition.value?.flows.forEach(item => item.steps.forEach(step => {
    step.with = rewriteFlowReferencePrefix(step.with || {}, oldKey, newKey) as Record<string, unknown>;
    step.bind = rewriteFlowReferencePrefix(step.bind || {}, oldKey, newKey) as Record<string, string>;
    step.produces = rewriteFlowReferencePrefix(step.produces || {}, oldKey, newKey) as Record<string, string>;
  }));
  markDirty();
}

function rewriteFlowReferencePrefix(value: unknown, oldKey: string, newKey: string): unknown {
  if (typeof value === 'string') {
    const oldPrefix = `@${oldKey}.`;
    return value.startsWith(oldPrefix) ? `@${newKey}.${value.slice(oldPrefix.length)}` : value;
  }
  if (Array.isArray(value)) return value.map(item => rewriteFlowReferencePrefix(item, oldKey, newKey));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) =>
      [key, rewriteFlowReferencePrefix(nested, oldKey, newKey)]));
  }
  return value;
}

function moveStep(flow: BusinessFlow, index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= flow.steps.length) return;
  [flow.steps[index], flow.steps[nextIndex]] = [flow.steps[nextIndex], flow.steps[index]];
  markDirty();
}

async function load() {
  clearUiStructuredState();
  const generation = ++businessLoadGeneration;
  const requestedBusinessId = businessId.value;
  loading.value = true; loadError.value = '';
  try {
    const detail = parseBusinessPayload(dataOf(await getBusiness(requestedBusinessId)), requestedBusinessId);
    if (generation !== businessLoadGeneration || requestedBusinessId !== businessId.value) return;
    definition.value = detail.definition;
    definition.value.uis.forEach(ui => { ui.fields ||= {}; });
    definition.value.flows.forEach(flow => { if (flow.entry?.kind === 'external') flow.entry.valueDescriptions ||= {}; flow.steps.forEach(step => { step.with ||= {}; step.produces ||= {}; step.bind ||= {}; }); });
    if (!definition.value.flows.some(flow => flow.key === selectedFlowKey.value)) {
      selectedFlowKey.value = String(definition.value.flows[0]?.key || '');
      selectedStepIndex.value = definition.value.flows[0]?.steps.length ? 0 : -1;
    } else {
      const selected = definition.value.flows.find(flow => flow.key === selectedFlowKey.value);
      if (!selected || selectedStepIndex.value >= selected.steps.length) selectedStepIndex.value = selected?.steps.length ? selected.steps.length - 1 : -1;
    }
    const beforeResources = JSON.stringify(definition.value.flows);
    definition.value.flows.forEach(flow => flow.steps.forEach((step, index) => {
      registerStepResources(flow, index, actionOutputs(step.action));
      if (step.action === 'audio.record' && !step.with?.mode) step.with!.mode = flow.entry?.kind === 'device' ? 'toggle' : 'timed';
    }));
    revision.value = detail.revision; hasTarget.value = Boolean(definition.value.devices?.target);
    dirty.value = beforeResources !== JSON.stringify(definition.value.flows);
    await refreshResources(requestedBusinessId, generation);
  } catch (error: any) {
    if (generation === businessLoadGeneration && requestedBusinessId === businessId.value) loadError.value = error.message || '读取业务失败';
  }
  finally { if (generation === businessLoadGeneration) loading.value = false; }
}

async function refreshResources(requestedBusinessId = businessId.value, generation = businessLoadGeneration) {
  const requestId = ++resourceRequestGeneration;
  resourcesLoading.value = true;
  resourcesError.value = '';
  try {
    const result = parseResources(dataOf(await getBusinessResources(requestedBusinessId)), requestedBusinessId);
    if (generation === businessLoadGeneration && requestId === resourceRequestGeneration && requestedBusinessId === businessId.value) resources.value = result;
  } catch (cause: any) {
    if (generation === businessLoadGeneration && requestId === resourceRequestGeneration && requestedBusinessId === businessId.value) {
      resources.value = null;
      resourcesError.value = cause.message || '业务资源读取失败';
    }
  } finally {
    if (requestId === resourceRequestGeneration) resourcesLoading.value = false;
  }
}
async function loadReferenceCatalog() {
  const claimed = await loadAllClaimedDevices();
  const merged = new Map<string, ActionCatalogEntry & { supportLabel?: string }>();
  for (const action of platformActions.value) if (isVisibleBusinessAction(action.action)) merged.set(action.action, action);
  const support = new Map<string, number>();
  for (let index = 0; index < claimed.length; index += 20) {
    const batch = claimed.slice(index, index + 20);
    const results = await Promise.allSettled(batch.map(device => getActionCatalog(device.deviceId)));
    results.forEach((result, offset) => {
      if (result.status !== 'fulfilled') return;
      const catalog = parseActionCatalog(dataOf(result.value), batch[offset].deviceId);
      if (!catalog.schemaSynced) return;
      for (const action of catalog.actions) {
        if (!isVisibleBusinessAction(action.action)) continue;
        if (action.source === 'platform' && !isBusinessRecipe(action.action)) continue;
        support.set(action.action, (support.get(action.action) || 0) + 1);
        if (!merged.has(action.action)) merged.set(action.action, action);
      }
    });
  }
  actions.value = [...merged.values()].sort((a, b) => Number(isBusinessRecipe(b.action)) - Number(isBusinessRecipe(a.action)))
    .map(action => isBusinessRecipe(action.action) || support.has(action.action)
      ? { ...action, supportLabel: claimed.length ? `${support.get(action.action) || 0}/${claimed.length} 台设备支持` : '部署时校验设备能力' }
      : action);
}
async function loadReferenceData() {
  const requestId = ++catalogLoadRequestId;
  catalogLoading.value = true;
  catalogErrors.value = { sections: '', actions: '', devices: '' };
  const [sectionResult, actionResult] = await Promise.allSettled([
    getSectionCatalog(), getActionCatalog()
  ]);
  if (requestId !== catalogLoadRequestId) return;
  if (sectionResult.status === 'fulfilled') {
    try {
      const sectionCatalog = parseSectionCatalog(dataOf(sectionResult.value));
      sections.value = sectionCatalog;
      sectionsLoaded.value = true;
    } catch (cause: any) { catalogErrors.value.sections = `界面模板目录：${cause.message || '响应格式无效'}`; }
  } else catalogErrors.value.sections = `界面模板目录：${sectionResult.reason?.message || '读取失败'}`;
  if (actionResult.status === 'fulfilled') {
    try {
      const catalog = parseActionCatalog(dataOf(actionResult.value));
      platformActions.value = catalog.actions;
      actions.value = platformActions.value.filter(action => isVisibleBusinessAction(action.action));
    } catch (cause: any) {
      catalogErrors.value.actions = `平台动作目录：${cause.message || '响应格式无效'}`;
    }
  } else {
    catalogErrors.value.actions = `平台动作目录：${actionResult.reason?.message || '读取失败'}`;
  }
  devices.value = [];
  catalogLoading.value = false;
  try { await loadReferenceCatalog(); } catch (cause: any) { catalogErrors.value.actions = `设备动作目录：${cause.message || '读取失败'}`; }
}
async function loadAllClaimedDevices(): Promise<SduiDeviceOption[]> {
  const pageSize = 200;
  const first = dataOf(await listSduiDevices(0, pageSize));
  if (!isRecord(first) || !Number.isInteger(first.totalCount) || (first.totalCount as number) < 0
    || first.page !== 0 || first.size !== pageSize || !Array.isArray(first.items)) {
    throw new Error('终端列表第 1 页响应格式无效');
  }
  const totalCount = first.totalCount as number;
  const devices: SduiDeviceOption[] = [];
  const seen = new Set<string>();
  const acceptPage = (pageValue: unknown, page: number) => {
    if (!isRecord(pageValue) || pageValue.totalCount !== totalCount || pageValue.page !== page
      || pageValue.size !== pageSize || !Array.isArray(pageValue.items)) {
      throw new Error(`终端列表第 ${page + 1} 页响应与请求不一致`);
    }
    const items = pageValue.items;
    if (!items.every(item => isRecord(item) && typeof item.deviceId === 'string' && item.deviceId.length > 0
      && (item.name === null || typeof item.name === 'string')
      && (item.status === null || typeof item.status === 'string')
      && (item.capabilitySyncState === null || typeof item.capabilitySyncState === 'string')
      && item.registrationStatus === 'CLAIMED')) {
      throw new Error(`终端列表第 ${page + 1} 页包含无效终端`);
    }
    for (const item of items as SduiDeviceOption[]) {
      if (seen.has(item.deviceId)) throw new Error(`终端列表重复返回设备 ${item.deviceId}`);
      seen.add(item.deviceId);
      devices.push(item);
    }
  };
  acceptPage(first, 0);
  const pageCount = Math.ceil(totalCount / pageSize);
  for (let page = 1; page < pageCount; page++) {
    const response = await listSduiDevices(page, pageSize);
    acceptPage(dataOf(response), page);
  }
  if (devices.length !== totalCount) throw new Error(`终端列表不完整：预期 ${totalCount} 台，收到 ${devices.length} 台`);
  return devices;
}
function fieldsFor(template: string): SectionField[] { return sections.value[template]?.displayFields || []; }
function uiStructuredKey(ui: BusinessUiResource, path: string): string {
  return `${businessId.value}:${ui.key}:${path}`;
}
function uiStructuredDraft(ui: BusinessUiResource, path: string, value: unknown, type: string): string {
  const key = uiStructuredKey(ui, path);
  if (key in uiStructuredDrafts) return uiStructuredDrafts[key];
  return JSON.stringify(value ?? (type === 'array' ? [] : {}), null, 2) || (type === 'array' ? '[]' : '{}');
}
function setUiStructuredField(ui: BusinessUiResource, owner: Record<string, unknown>, fieldName: string,
  path: string, type: string, text: string) {
  const key = uiStructuredKey(ui, path);
  uiStructuredDrafts[key] = text;
  markDirty();
  try {
    const value: unknown = JSON.parse(text);
    if (type === 'object' && !isRecord(value)) throw new Error('必须填写 JSON 对象');
    if (type === 'array' && !Array.isArray(value)) throw new Error('必须填写 JSON 数组');
    owner[fieldName] = value;
    delete uiStructuredErrors[key];
  } catch (cause: any) {
    uiStructuredErrors[key] = cause.message || 'JSON 格式无效';
  }
}
function clearUiStructuredState(uiKey?: string) {
  const prefix = uiKey == null ? null : `${businessId.value}:${uiKey}:`;
  for (const key of Object.keys(uiStructuredDrafts)) if (prefix == null || key.startsWith(prefix)) delete uiStructuredDrafts[key];
  for (const key of Object.keys(uiStructuredErrors)) if (prefix == null || key.startsWith(prefix)) delete uiStructuredErrors[key];
}
function ensureUiStructuredFieldsValid(): boolean {
  const firstError = Object.values(uiStructuredErrors)[0];
  if (!firstError) return true;
  ElMessage.warning(`请先修正界面 JSON 字段：${firstError}`);
  return false;
}
function utf8ByteLength(value: unknown): number {
  return new TextEncoder().encode(value == null ? '' : String(value)).length;
}
function isOutsideLengthBounds(value: unknown, min?: number, max?: number): boolean {
  const length = utf8ByteLength(value);
  return (min != null && length < min) || (max != null && length > max);
}
function byteLengthHint(value: unknown, min?: number, max?: number): string {
  const range = min != null && max != null ? `${min}～${max}` : min != null ? `≥${min}` : `≤${max}`;
  return `${utf8ByteLength(value)} / ${range} UTF-8 bytes`;
}
function fieldsForUi(uiKey?: string) { const ui = definition.value?.uis.find(item => item.key === uiKey); return ui ? fieldsFor(ui.template).filter(field => field.parameterizable) : []; }
function defaultFieldValue(field: SectionField, template?: string): unknown {
  if (field.type === 'array') {
    const minimum = template ? arrayBounds(template, field.name).min : 0;
    return Array.from({ length: minimum }, () => defaultArrayItem(field, template));
  }
  if (field.defaultValue !== undefined) return structuredClone(field.defaultValue);
  if (['number', 'integer', 'int', 'float'].includes(field.type)) {
    return Math.max(field.min ?? Number.NEGATIVE_INFINITY,
      Math.min(field.max ?? Number.POSITIVE_INFINITY, 0));
  }
  if (field.type === 'boolean') return false;
  if (field.type === 'object') return {};
  return '';
}
function defaultFieldsFor(template: string): Record<string, unknown> {
  if (isChartSection(template)) return defaultChartFields(template);
  return Object.fromEntries(fieldsFor(template).map(field => [field.name, defaultFieldValue(field, template)]));
}
function defaultArrayItem(field: SectionField, template?: string): unknown {
  if (!(field.children || []).length) return 0;
  return Object.fromEntries(field.children.map(child => [child.name, defaultFieldValue(child, template)]));
}
function hasConfiguredUiFields(fields: Record<string, unknown>): boolean {
  return Object.values(fields).some(value => value !== undefined && value !== ''
    && !(Array.isArray(value) && value.length === 0)
    && !(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0));
}
async function changeTemplate(ui: BusinessUiResource, nextTemplate: string) {
  if (!nextTemplate || nextTemplate === ui.template) return;
  if (!sections.value[nextTemplate]) {
    ElMessage.warning('所选界面模板不在当前已加载目录中，请刷新目录后再试');
    return;
  }
  if (hasConfiguredUiFields(ui.fields || {})) {
    try {
      await ElMessageBox.confirm(
        `切换到“${sections.value[nextTemplate]?.displayName || nextTemplate}”会用新模板默认值替换“${ui.template}”的字段内容，继续吗？`,
        '确认切换界面模板',
        { type: 'warning', confirmButtonText: '替换字段', cancelButtonText: '保留当前模板' }
      );
    } catch { return; }
  }
  clearUiStructuredState(ui.key);
  definition.value?.flows.forEach(flow => {
    if (flow.entry?.kind === 'device' && flow.entry.ui === ui.key) flow.entry.interaction = '';
  });
  ui.template = nextTemplate;
  ui.fields = defaultFieldsFor(nextTemplate);
  markDirty();
}
function addUiArrayItem(ui: any, field: SectionField) { ui.fields[field.name] ||= []; ui.fields[field.name].push(defaultArrayItem(field, ui.template)); markDirty(); }
function removeUiArrayItem(ui: any, fieldName: string, index: number) {
  ui.fields[fieldName].splice(index, 1);
  if (ui.template === 'menu_section' && fieldName === 'items') {
    if (definition.value) removeMenuItemBinding(definition.value, ui, index);
  }
  markDirty();
}
function arrayBounds(template: string, fieldName: string) { const constraints = sections.value[template]?.constraints || {}; return { min: constraints[`${fieldName}_min`] ?? 0, max: constraints[`${fieldName}_max`] ?? Number.POSITIVE_INFINITY }; }
function arrayBoundsLabel(template: string, fieldName: string): string {
  const constraints = sections.value[template]?.constraints || {};
  const min = constraints[`${fieldName}_min`];
  const max = constraints[`${fieldName}_max`];
  if (min != null && max != null) return `${min}～${max} 项`;
  if (min != null) return `至少 ${min} 项`;
  if (max != null) return `最多 ${max} 项`;
  return '目录未声明项数限制';
}
function updateTarget(enabled: boolean) {
  if (!definition.value) return;
  if (!enabled) {
    if (targetReassignmentItems.value.length) {
      targetBlockNotice.value = true;
      hasTarget.value = true;
      ElMessage.warning(`仍有 ${targetReassignmentItems.value.length} 处配置指向对端；可在设备形态提示中逐项定位`);
      return;
    }
  }
  targetBlockNotice.value = false;
  const devices = { ...(definition.value.devices || { local: {} }) };
  if (enabled) devices.target = {}; else delete devices.target;
  definition.value.devices = devices;
  markDirty();
}
function actionParameters(action: string) { return actions.value.find(item => item.action === action)?.parameters || []; }
function actionParameterLabel(param: ActionParameterDocumentation) {
  const suffix = [param.unit, ['int', 'integer', 'number', 'float'].includes(param.type)
    && (param.min != null || param.max != null) ? `${param.min ?? '−∞'}～${param.max ?? '∞'}` : ''].filter(Boolean).join(' · ');
  const label = ({ audio: '音频资源', text: '文字内容', tone: '提示音', duration_ms: '采集时长', image: '图片', frames: '画面帧序列', fps: '播放帧率' } as Record<string, string>)[param.name] || param.name;
  return `${label}${param.required ? ' *' : ''}${suffix ? `（${suffix}）` : ''}`;
}
function actionOutputs(action: string) { return (actions.value.find(item => item.action === action) || platformActions.value.find(item => item.action === action))?.out || {}; }
function jsonValue(value: unknown) { return value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value, null, 2); }
function jsonParamValue(value: unknown) { return value == null ? '' : JSON.stringify(value, null, 2) || ''; }
function numericParamValue(value: unknown): number | undefined { return typeof value === 'number' ? value : undefined; }
function isParamReference(value: unknown): boolean { return typeof value === 'string' && value.startsWith('@'); }
const literalUiBindings = new WeakMap<object, Map<string, unknown>>();
function toggleUiBindingReference(step: BusinessFlow['steps'][number], name: string) {
  step.bind ||= {};
  let remembered = literalUiBindings.get(step);
  if (!remembered) { remembered = new Map(); literalUiBindings.set(step, remembered); }
  if (isParamReference(step.bind[name])) {
    if (remembered.has(name)) step.bind[name] = remembered.get(name);
    else delete step.bind[name];
    remembered.delete(name);
  } else {
    if (Object.prototype.hasOwnProperty.call(step.bind, name)) remembered.set(name, step.bind[name]);
    step.bind[name] = '@';
  }
  markDirty();
}
function clearEmptyUiBinding(step: BusinessFlow['steps'][number], name: string) {
  if (step.bind[name] === '') delete step.bind[name];
  markDirty();
}
function setUiBindingJson(step: BusinessFlow['steps'][number], name: string, text: string) {
  if (!text.trim()) { delete step.bind[name]; markDirty(); return; }
  try { step.bind[name] = JSON.parse(text); markDirty(); }
  catch { ElMessage.error('请输入有效的 JSON'); }
}
const literalParamValues = new WeakMap<object, Map<string, unknown>>();
function toggleParamReference(step: BusinessFlow['steps'][number], param: ActionParameterDocumentation, flowKey: string) {
  step.with ||= {};
  let remembered = literalParamValues.get(step);
  if (!remembered) { remembered = new Map(); literalParamValues.set(step, remembered); }
  const current = step.with[param.name];
  if (isParamReference(current)) {
    if (remembered.has(param.name)) step.with[param.name] = remembered.get(param.name);
    else delete step.with[param.name];
    remembered.delete(param.name);
  } else {
    if (Object.prototype.hasOwnProperty.call(step.with, param.name)) remembered.set(param.name, current);
    step.with[param.name] = compatibleValueResources(param, flowKey, step.action)[0]?.reference || '@';
  }
  markDirty();
}
function actionInputValueType(actionName: string, parameterName: string): string | undefined {
  return actions.value.find((item) => item.action === actionName)?.in?.[parameterName]?.toLowerCase();
}
function compatibleValueResources(param: ActionParameterDocumentation, flowKey: string, actionName: string) {
  const expected = actionInputValueType(actionName, param.name);
  const knownValueTypes = new Set(['text', 'number', 'series', 'image', 'audio']);
  return availableFlowResources(draftResources.value, flowKey, selectedStepIndex.value,
    expected && knownValueTypes.has(expected) ? expected : undefined);
}

function setParamReference(step: BusinessFlow['steps'][number], param: ActionParameterDocumentation, value: string) {
  step.with ||= {};
  if (value) step.with[param.name] = value;
  else delete step.with[param.name];
  markDirty();
}
function setNumericParam(step: BusinessFlow['steps'][number], param: ActionParameterDocumentation, value: number | null | undefined) {
  if (value == null) {
    delete step.with[param.name];
    markDirty();
    return;
  }
  if (!Number.isFinite(value)) return;
  if (['int', 'integer'].includes(param.type) && !Number.isInteger(value)) {
    ElMessage.error(`${param.name} 必须是整数`);
    return;
  }
  if ((param.min != null && value < param.min) || (param.max != null && value > param.max)) {
    ElMessage.error(`${param.name} 必须在 ${param.min ?? '−∞'}～${param.max ?? '∞'} 范围内`);
    return;
  }
  step.with[param.name] = value;
  markDirty();
}
function setJsonParam(step: any, param: ActionParameterDocumentation, raw: string) {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { ElMessage.error(`${param.name} 必须是有效 JSON`); return; }
  const isReference = typeof parsed === 'string' && /^@.+/.test(parsed);
  const matchesType = isReference || (param.type === 'object'
    ? parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    : Array.isArray(parsed));
  if (!matchesType) {
    ElMessage.error(`${param.name} 必须是 JSON ${param.type}`);
    return;
  }
  step.with[param.name] = parsed;
  markDirty();
}
function parseStepParams(step: any, raw: string) { try { const parsed = JSON.parse(raw || '{}'); if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('JSON 参数必须是对象'); step.with = parsed; markDirty(); } catch { ElMessage.error('步骤参数必须是有效 JSON 对象'); } }
async function setTriggerKind(flow: BusinessFlow, kind: 'device' | 'external') {
  if (flow.entry?.kind === kind) return;
  const requestedBusinessId = businessId.value;
  const routeGeneration = businessRouteGeneration;
  const submittedRevision = editRevision;
  const previousKind = flow.entry?.kind;
  const hasConfiguration = previousKind === 'external'
    ? Boolean(flow.entry.name || Object.keys(flow.entry.values || {}).length)
    : previousKind === 'device'
      ? Boolean(flow.entry.interaction || flow.entry.ui)
      : false;
  if (hasConfiguration) {
    try {
      const discarded = previousKind === 'external' ? '触发名称和输入值' : '交互点和界面绑定';
      await ElMessageBox.confirm(`切换为${kind === 'external' ? '外部触发' : '设备交互'}会清除现有${discarded}，继续吗？`,
        '确认切换触发类型', { type: 'warning', confirmButtonText: '清除并切换', cancelButtonText: '保留原配置' });
    } catch { return; }
  }
  if (routeGeneration !== businessRouteGeneration || requestedBusinessId !== businessId.value
    || !definition.value?.flows.includes(flow) || submittedRevision !== editRevision) return;
  clearMenuAction(flow);
  flow.entry = kind === 'device' ? { kind, ui: definition.value?.uis[0]?.key || '', interaction: '' } : { kind, name: '', values: {} };
  markDirty();
}
function externalEntry(flow: BusinessFlow): ExternalFlowEntry | null {
  return flow.entry?.kind === 'external' ? flow.entry : null;
}
function addTriggerValue(flow: BusinessFlow) {
  if (!flow.entry) flow.entry = { kind: 'external', name: '', values: {} };
  const entry = externalEntry(flow);
  if (!entry) return;
  entry.values ||= {};
  entry.valueDescriptions ||= {};
  let suffix = Object.keys(entry.values).length + 1;
  while (Object.prototype.hasOwnProperty.call(entry.values, `value${suffix}`)) suffix += 1;
  entry.values[`value${suffix}`] = 'text';
  entry.valueDescriptions[`value${suffix}`] = '';
  markDirty();
}
function renameTriggerValue(flow: BusinessFlow, oldName: string, rawName: string) {
  const newName = rawName.trim();
  const entry = externalEntry(flow);
  if (!entry || !newName) {
    ElMessage.warning('输入值名称不能为空');
    if (entry) entry.values = { ...(entry.values || {}) };
    return;
  }
  if (newName === oldName) return;
  if (Object.prototype.hasOwnProperty.call(entry.values || {}, newName)) {
    ElMessage.warning(`输入值“${newName}”已存在`);
    entry.values = { ...(entry.values || {}) };
    return;
  }

  const oldReference = `@${flow.key}.${oldName}`;
  const newReference = `@${flow.key}.${newName}`;
  entry.values = Object.fromEntries(Object.entries(entry.values || {})
    .map(([name, type]) => [name === oldName ? newName : name, type]));
  entry.valueDescriptions ||= {};
  entry.valueDescriptions = Object.fromEntries(Object.entries(entry.valueDescriptions)
    .map(([name, description]) => [name === oldName ? newName : name, description]));
  definition.value?.flows.flatMap(item => item.steps).forEach(step => {
    step.with = rewriteValueReference(step.with || {}, oldReference, newReference) as Record<string, unknown>;
    step.bind = rewriteValueReference(step.bind || {}, oldReference, newReference) as Record<string, string>;
  });
  markDirty();
}
function rewriteValueReference(value: unknown, oldReference: string, newReference: string): unknown {
  if (value === oldReference) return newReference;
  if (Array.isArray(value)) return value.map(item => rewriteValueReference(item, oldReference, newReference));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) =>
      [key, rewriteValueReference(nested, oldReference, newReference)]));
  }
  return value;
}
async function removeTriggerValue(flow: BusinessFlow, name: string) {
  const entry = externalEntry(flow);
  if (!entry?.values || !Object.prototype.hasOwnProperty.call(entry.values, name)) return;
  const requestedBusinessId = businessId.value;
  const routeGeneration = businessRouteGeneration;
  const submittedRevision = editRevision;
  const expectedReference = `@${flow.key}.${name}`;
  const references = flow.steps.flatMap((step, index) => [
    ...findExactReferencePaths(step.with, expectedReference, `第 ${index + 1} 步参数`),
    ...findExactReferencePaths(step.bind, expectedReference, `第 ${index + 1} 步界面绑定`)
  ]);
  if (references.length) {
    const preview = references.slice(0, 5).join('、');
    const more = references.length > 5 ? `，另有 ${references.length - 5} 处` : '';
    try {
      await ElMessageBox.confirm(
        `“@${flow.key}.${name}”仍被 ${references.length} 处使用：${preview}${more}。删除不会自动清除这些引用，它们会在校验中显示为未解析。确认删除？`,
        '删除已引用的输入值', { type: 'warning', confirmButtonText: '删除输入值', cancelButtonText: '保留输入值' }
      );
    } catch { return; }
  }
  if (routeGeneration !== businessRouteGeneration || requestedBusinessId !== businessId.value
    || submittedRevision !== editRevision || !definition.value?.flows.includes(flow)
    || externalEntry(flow) !== entry || !Object.prototype.hasOwnProperty.call(entry.values, name)) return;
  delete entry.values[name];
  if (entry.valueDescriptions) delete entry.valueDescriptions[name];
  markDirty();
}
function findExactReferencePaths(value: unknown, expected: string, path: string): string[] {
  if (value === expected) return [path];
  if (Array.isArray(value)) return value.flatMap((item, index) => findExactReferencePaths(item, expected, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => findExactReferencePaths(item, expected, `${path}.${key}`));
  }
  return [];
}
function isPlatformStep(step: any) { const role = actions.value.find(item => item.action === step.action)?.role; return !step.action || /^(ai\.|platform\.)/.test(step.action) || role === 'source' || role === 'converter'; }
async function onStepActionChange(step: any, nextAction: string) {
  const previousAction = step.action;
  if (!nextAction || nextAction === previousAction) return;
  const requestedBusinessId = businessId.value;
  const routeGeneration = businessRouteGeneration;
  const submittedRevision = editRevision;
  const hasActionConfig = Object.keys(step.with || {}).length > 0 || Object.keys(step.produces || {}).length > 0
    || Object.keys(step.bind || {}).length > 0 || Boolean(step.ui);
  if (hasActionConfig) {
    try {
      await ElMessageBox.confirm(
        `切换动作会清除“${previousAction}”的参数、产出和界面绑定，继续吗？`,
        '确认切换动作',
        { type: 'warning', confirmButtonText: '清除并切换', cancelButtonText: '保留原动作' }
      );
    } catch { return; }
  }
  const stepStillCurrent = definition.value?.flows.some(flow => flow.steps.includes(step));
  if (routeGeneration !== businessRouteGeneration || requestedBusinessId !== businessId.value
    || !stepStillCurrent || editRevision !== submittedRevision) return;
  step.action = nextAction;
  step.with = {};
  step.produces = {};
  step.bind = {};
  const flow = definition.value?.flows.find(item => item.steps.includes(step));
  if (flow) {
    registerStepResources(flow, flow.steps.indexOf(step), actionOutputs(nextAction));
    if (nextAction === 'audio.record') step.with.mode = flow.entry?.kind === 'device' ? 'toggle' : 'timed';
    if (nextAction === 'audio.play') step.with.text = '';
  }
  if (nextAction === 'ui.show') step.ui = '';
  else delete step.ui;
  if (isPlatformStep(step)) step.target = undefined;
  else if (!step.target) step.target = 'local';
  markDirty();
}
function firstUiShowStep(flow: BusinessFlow) { return flow.steps[0]?.action === 'ui.show' ? flow.steps[0] : null; }
function flowScreenValue(flow: BusinessFlow, flowIndex: number): string {
  if (!definition.value) return '';
  if (!flow.entry && flowIndex === 0) return String(definition.value.uis[0]?.key || '');
  if (flow.entry?.kind === 'device') return String(flow.entry.ui || '');
  return String(firstUiShowStep(flow)?.ui || '');
}
function flowScreenValidationPath(flow: BusinessFlow, flowIndex: number): string {
  if (!flow.entry && flowIndex === 0) return `flows[${flowIndex}]`;
  if (flow.entry?.kind === 'device') return `flows[${flowIndex}].entry.ui`;
  if (firstUiShowStep(flow)) return `flows[${flowIndex}].steps[0].ui`;
  return `flows[${flowIndex}]`;
}
function flowScreenPlaceholder(flow: BusinessFlow, flowIndex: number): string {
  if (!definition.value?.uis.length) return '不显示界面';
  if (flow.entry?.kind === 'external' || flowIndex > 0 && !flow.entry) return '不显示界面';
  return '选择屏幕';
}
function screenOptionLabel(ui: BusinessUiResource, flow: BusinessFlow, flowIndex: number): string {
  return !flow.entry && flowIndex === 0 && definition.value?.uis[0]?.key === ui.key
    ? `${ui.key} · 初始界面`
    : String(ui.key);
}
async function setFlowScreen(flow: BusinessFlow, flowIndex: number, key: string) {
  if (!definition.value) return;
  if (!flow.entry && flowIndex === 0) {
    const selectedIndex = definition.value.uis.findIndex(ui => String(ui.key) === key);
    if (selectedIndex > 0) {
      const [selected] = definition.value.uis.splice(selectedIndex, 1);
      definition.value.uis.unshift(selected);
      markDirty();
    }
    return;
  }
  if (flow.entry?.kind === 'device') {
    if (flow.entry.ui === key) return;
    clearMenuAction(flow);
    flow.entry.ui = key;
    flow.entry.interaction = '';
    markDirty();
    return;
  }
  const screenStep = firstUiShowStep(flow);
  if (!key) {
    if (!screenStep) return;
    try {
      await ElMessageBox.confirm('将移除本环节首个 ui.show 步骤及其界面绑定，改为沿用当前屏幕。', '沿用当前屏幕', { type: 'warning', confirmButtonText: '移除切屏步骤', cancelButtonText: '取消' });
    } catch { return; }
    if (!definition.value?.flows.includes(flow) || flow.steps[0] !== screenStep) return;
    flow.steps.shift();
    markDirty();
    return;
  }
  if (screenStep) {
    await setUiShowTarget(screenStep, key);
  } else {
    const ui = definition.value.uis.find(item => String(item.key) === key);
    if (!ui) return;
    flow.steps.unshift({ action: 'ui.show', target: ui.owner, ui: key, with: {}, produces: {}, bind: {} });
    markDirty();
  }
}
async function setUiShowTarget(step: BusinessFlow['steps'][number], key: string) {
  const routeGeneration = businessRouteGeneration;
  const targetUi = definition.value?.uis.find(ui => String(ui.key) === key);
  if (!targetUi) return;
  const allowedFields = new Set(fieldsForUi(key).map(field => field.name));
  const staleBindings = Object.keys(step.bind || {}).filter(name => !allowedFields.has(name));
  const targetChanges = step.target !== targetUi.owner;
  if (staleBindings.length || targetChanges) {
    const effects = [
      targetChanges ? `显示目标将改为${targetUi.owner === 'target' ? '对端' : '本机'}` : '',
      staleBindings.length ? `新界面不包含字段 ${staleBindings.join('、')}，这些绑定会被移除` : ''
    ].filter(Boolean).join('；');
    try {
      await ElMessageBox.confirm(`${effects}。`, '切换显示界面', { type: 'warning', confirmButtonText: '切换界面', cancelButtonText: '取消' });
    } catch { return; }
  }
  if (routeGeneration !== businessRouteGeneration
      || !definition.value?.flows.some(flow => flow.steps.includes(step))) return;
  staleBindings.forEach(name => { delete step.bind[name]; });
  step.ui = key;
  step.target = targetUi.owner;
  markDirty();
}

async function saveMetadata() {
  if (!definition.value || !ensureUiStructuredFieldsValid()) return;
  const requestedBusinessId = businessId.value;
  const routeGeneration = businessRouteGeneration;
  const submittedRevision = editRevision;
  saving.value = true;
  try {
    const definitionToSave = definitionSnapshot(definition.value);
    const result = parseBusinessPayload(dataOf(await saveBusiness(requestedBusinessId, revision.value, definitionToSave)), requestedBusinessId);
    if (routeGeneration !== businessRouteGeneration || requestedBusinessId !== businessId.value) return;
    revision.value = result.revision;
    const unchangedSinceSubmit = editRevision === submittedRevision;
    if (unchangedSinceSubmit) {
      definition.value = result.definition;
      definition.value.flows.forEach(flow => { if (flow.entry?.kind === 'external') flow.entry.valueDescriptions ||= {}; });
      clearUiStructuredState();
      dirty.value = false;
      ElMessage.success('草稿已保存');
      await validate();
    } else {
      ElMessage.warning('已保存提交时的草稿；保存期间的新修改仍未保存，请再次保存');
    }
    if (routeGeneration !== businessRouteGeneration || requestedBusinessId !== businessId.value) return;
    await refreshResources(requestedBusinessId);
  } catch (cause: any) {
    if (routeGeneration === businessRouteGeneration && requestedBusinessId === businessId.value) {
      ElMessage.error(cause.message || '保存业务失败');
    }
  } finally {
    if (routeGeneration === businessRouteGeneration) saving.value = false;
  }
}

function renameUi(ui: BusinessUiResource, rawName: string) {
  const name = rawName.trim();
  if (!name || definition.value?.uis.some(item => item !== ui && item.key === name)) {
    ElMessage.warning('页面名称不能为空或重复'); return;
  }
  const previous = ui.key;
  clearUiStructuredState(previous);
  ui.key = name;
  if (definition.value) renamePageReferences(definition.value, previous, name);
  markDirty();
}
function triggerUi(flow: BusinessFlow) {
  const entry = flow.entry;
  return entry?.kind === 'device' ? definition.value?.uis.find(ui => ui.key === entry.ui) : undefined;
}
function menuActionFlows(ui: BusinessUiResource, index: number) {
  const interaction = `menu.item.${index + 1}`;
  return definition.value?.flows.filter((flow, flowIndex) => flowIndex > 0 && (!flow.entry
    || flow.entry.kind === 'device' && flow.entry.ui === ui.key && flow.entry.interaction === interaction)) || [];
}
function clearMenuAction(flow: BusinessFlow) {
  if (flow.entry?.kind !== 'device' || !flow.entry.interaction?.startsWith('menu.item.')) return;
  const ui = triggerUi(flow);
  const items = ui?.fields.items;
  if (Array.isArray(items)) items.forEach(item => { if (item.token === `@${flow.key}`) item.token = ''; });
}
function deviceInteractionOptions(flow: BusinessFlow) {
  const entry = flow.entry;
  const ui = triggerUi(flow);
  const options = ['pwr', 'plus'].flatMap(button =>
    ['short_press', 'long_press', 'down', 'up'].map(event => {
      const value = `button.${button}.${event}`;
      const occupied = definition.value?.flows.some(item => item !== flow && item.entry?.kind === 'device'
        && item.entry.interaction === value);
      const native = ui?.template === 'menu_section' && event === 'short_press';
      return { value, label: `${button === 'pwr' ? '电源按钮' : '加号按钮'} · ${{ short_press: '短按', long_press: '长按', down: '按下', up: '松开' }[event]}${native ? '（菜单导航占用）' : occupied ? '（已配置）' : ''}`, disabled: native || Boolean(occupied) };
    }));
  if (ui?.template === 'menu_section' && Array.isArray(ui.fields.items)) {
    ui.fields.items.forEach((item, index) => options.push({ value: `menu.item.${index + 1}`,
      label: `确认菜单项：${item.label || `选项 ${index + 1}`}`, disabled: Boolean(item.token && item.token !== `@${flow.key}`) }));
  }
  return options;
}
function deviceInteractionLabel(flow: BusinessFlow) {
  return deviceInteractionOptions(flow).find(option => option.value === (flow.entry?.kind === 'device' ? flow.entry.interaction : ''))?.label || '设备内部触发 · 待设置';
}
function setDeviceInteraction(flow: BusinessFlow, interaction: string) {
  if (flow.entry?.kind !== 'device') return;
  if (deviceInteractionOptions(flow).find(option => option.value === interaction)?.disabled) return;
  clearMenuAction(flow);
  flow.entry.interaction = interaction;
  const ui = triggerUi(flow);
  if (interaction.startsWith('menu.item.') && Array.isArray(ui?.fields.items)) {
    const item = ui.fields.items[Number(interaction.slice('menu.item.'.length)) - 1];
    if (item) item.token = `@${flow.key}`;
  }
  markDirty();
}
function bindMenuAction(ui: BusinessUiResource, index: number, value: string) {
  if (!definition.value || !Array.isArray(ui.fields.items)) return;
  const item = ui.fields.items[index];
  if (!item) return;
  let flow = definition.value.flows.find(flow => `@${flow.key}` === value);
  if (value === '__create__') {
    // Keep the first flow as deployment startup; menu actions always have explicit entries.
    if (!definition.value.flows.length) addFlow();
    flow = { key: uniqueBusinessName('菜单动作', definition.value.flows.map(flow => flow.key)), steps: [] };
    definition.value.flows.push(flow);
  }
  if (!flow || !menuActionFlows(ui, index).includes(flow)) return;
  const previous = definition.value.flows.find(flow => `@${flow.key}` === item.token);
  if (previous?.entry?.kind === 'device' && previous !== flow) previous.entry.interaction = '';
  flow.entry = { kind: 'device', ui: ui.key, interaction: `menu.item.${index + 1}` };
  item.token = `@${flow.key}`;
  selectedFlowKey.value = flow.key; selectedStepIndex.value = flow.steps.length ? 0 : -1;
  showResources.value = false;
  markDirty();
}
function addPageJump(flow: BusinessFlow, key: string) {
  const ui = definition.value?.uis.find(ui => ui.key === key);
  if (!ui) return;
  flow.steps.push({ action: 'ui.show', target: ui.owner, ui: key, with: {}, produces: {}, bind: {} });
  selectedStepIndex.value = flow.steps.length - 1;
  markDirty();
}

function addFlow() {
  if (!definition.value) return;
  const key = uniqueBusinessName('环节', definition.value.flows.map(flow => flow.key));
  definition.value.flows.push({ key, steps: [] });
  markDirty(); selectedFlowKey.value = key; selectedStepIndex.value = -1;
}
async function removeFlow(key: string) { try { await ElMessageBox.confirm(`删除环节“${key}”？`, '确认删除'); if (!definition.value) return; const index = definition.value.flows.findIndex(flow => flow.key === key); if (index >= 0) { clearMenuAction(definition.value.flows[index]); definition.value.flows.splice(index, 1); } markDirty(); if (selectedFlowKey.value === key) { selectedFlowKey.value = String(definition.value.flows[0]?.key || ''); selectedStepIndex.value = definition.value.flows[0]?.steps.length ? 0 : -1; } } catch (error: any) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '删除环节失败'); } }
function selectFlow(flow: BusinessFlow, index: number) { selectedFlowKey.value = String(flow.key); selectedStepIndex.value = flow.steps.length ? 0 : -1; }
function selectStep(flow: BusinessFlow, flowIndex: number, stepIndex: number) { selectedFlowKey.value = String(flow.key); selectedStepIndex.value = stepIndex; }
async function addStep(flowKey: string) {
  try { const action = 'ui.show'; const target = /^(ai\.|platform\.)/.test(action) ? undefined : 'local'; const index = definition.value?.flows.find(flow => flow.key === flowKey)?.steps.length || 0; const flow = definition.value?.flows.find(item => item.key === flowKey); if (!flow) return; flow.steps.push({ action, target, with: {}, produces: {}, bind: {} }); markDirty(); selectedFlowKey.value = flowKey; selectedStepIndex.value = index; }
  catch (error: any) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '添加步骤失败'); }
}
async function removeStep(flowKey: string, stepIndex: number) { try { const flow = definition.value?.flows.find(item => item.key === flowKey); if (flow && stepIndex >= 0 && stepIndex < flow.steps.length) { flow.steps.splice(stepIndex, 1); markDirty(); selectedStepIndex.value = Math.min(stepIndex, flow.steps.length - 1); } } catch (error: any) { ElMessage.error(error.message || '移除步骤失败'); } }
async function addUi(flowKey?: string) {
  if (!definition.value || uiCreating.value) return;
  uiCreating.value = true;
  const requestedBusinessId = businessId.value;
  const routeGeneration = businessRouteGeneration;
  const previousKeys = new Set(definition.value.uis.map(ui => String(ui.key)));
  try {
    const key = uniqueBusinessName('页面', definition.value.uis.map(ui => ui.key));
    if (routeGeneration !== businessRouteGeneration || requestedBusinessId !== businessId.value || !definition.value) return;
    const template = Object.keys(sections.value)[0];
    if (!template) throw new Error('界面模板目录为空');
    if (!definition.value) return;
    if (definition.value.uis.some(ui => String(ui.key) === key)) throw new Error(`界面 key “${key}”已存在`);
    const createdUi: BusinessUiResource = { key, template, fields: defaultFieldsFor(template), owner: 'local' };
    definition.value.uis.push(createdUi); markDirty();
    if (routeGeneration !== businessRouteGeneration || requestedBusinessId !== businessId.value || !flowKey || !definition.value) return;
    const created = definition.value.uis.find(ui => !previousKeys.has(String(ui.key)));
    const flowIndex = definition.value.flows.findIndex(flow => String(flow.key) === flowKey);
    const flow = definition.value.flows[flowIndex];
    if (created && flow && flowIndex >= 0) await setFlowScreen(flow, flowIndex, String(created.key));
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close' && routeGeneration === businessRouteGeneration && requestedBusinessId === businessId.value) ElMessage.error(error.message || '添加界面失败');
  } finally {
    uiCreating.value = false;
  }
}
async function generateMirror() {
  if (!hasTarget.value) {
    ElMessage.warning('镜像需要“本机 + 对端”设备形态');
    return;
  }
  const requestedBusinessId = businessId.value;
  const routeGeneration = businessRouteGeneration;
  try {
    await ElMessageBox.confirm(
      '将在当前草稿中交换本机与对端的界面归属和步骤目标，并启用镜像。保存后更新当前业务定义。',
      '生成镜像配置',
      { type: 'warning', confirmButtonText: '生成并保存', cancelButtonText: '取消' }
    );
    if (requestedBusinessId !== businessId.value || routeGeneration !== businessRouteGeneration) return;
    mirrorGenerating.value = true;
    if (!definition.value) return;
    definition.value.uis = definition.value.uis.map(ui => ({ ...ui, owner: ui.owner === 'target' ? 'local' : 'target' }));
    definition.value.flows.forEach(flow => flow.steps.forEach(step => { if (step.target) step.target = step.target === 'target' ? 'local' : 'target'; }));
    definition.value.mirror = true; markDirty();
    if (requestedBusinessId === businessId.value && routeGeneration === businessRouteGeneration) ElMessage.success('镜像配置已加入当前草稿；保存后更新当前业务定义');
  } catch (cause: any) {
    if (cause !== 'cancel' && cause !== 'close' && requestedBusinessId === businessId.value && routeGeneration === businessRouteGeneration) {
      ElMessage.error(cause.message || '生成镜像配置失败');
    }
  } finally {
    if (routeGeneration === businessRouteGeneration) mirrorGenerating.value = false;
  }
}
async function removeUi(key: string) {
  const uiIndex = definition.value?.uis.findIndex(ui => ui.key === key) ?? -1;
  const references = (definition.value?.flows || []).flatMap(flow => {
    const found: string[] = [];
    if (flow.entry?.kind === 'device' && flow.entry.ui === key) found.push(`${flow.key} 的设备触发器`);
    flow.steps.forEach((step, index) => { if (step.ui === key) found.push(`${flow.key} 第 ${index + 1} 步`); });
    return found;
  });
  const impacts = [
    uiIndex === 0 ? '这是当前初始界面，删除后下一界面会成为初始界面。' : '',
    references.length ? `以下位置仍引用它：${references.join('、')}。删除后服务端校验会报告悬空引用。` : ''
  ].filter(Boolean).join('\n');
  try {
    await ElMessageBox.confirm(`删除界面“${key}”？${impacts ? `\n\n${impacts}` : ''}`, '确认删除', { type: impacts ? 'warning' : 'info', confirmButtonText: '删除界面' });
    if (!definition.value) return; definition.value.uis.splice(uiIndex, 1); markDirty(); clearUiStructuredState(key);
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '删除界面失败');
  }
}
async function makeInitial(key: string) { try { const index = definition.value?.uis.findIndex(ui => ui.key === key) ?? -1; if (definition.value && index > 0) { const [ui] = definition.value.uis.splice(index, 1); definition.value.uis.unshift(ui); markDirty(); } ElMessage.success('初始界面已更新到当前草稿'); } catch (error: any) { ElMessage.error(error.message || '设置初始界面失败'); } }
async function validate(): Promise<boolean> {
  const requestedBusinessId = businessId.value;
  const routeGeneration = businessRouteGeneration;
  let validatedRevision = editRevision;
  validating.value = true;
  validationError.value = '';
  try {
    if (routeGeneration !== businessRouteGeneration || requestedBusinessId !== businessId.value || !definition.value) return false;
    validatedRevision = editRevision;
    const result = parseValidationProjection(dataOf(await validateBusiness(requestedBusinessId, definitionSnapshot(definition.value))));
    if (routeGeneration === businessRouteGeneration && requestedBusinessId === businessId.value) {
      if (editRevision === validatedRevision) {
        validation.value = result;
        return result.ok;
      }
      validationError.value = '校验期间草稿已修改，请重新校验';
    }
    return false;
  } catch (error: any) {
    if (routeGeneration === businessRouteGeneration && requestedBusinessId === businessId.value) validationError.value = error.message || '保存草稿或校验失败';
    return false;
  } finally {
    if (routeGeneration === businessRouteGeneration) validating.value = false;
  }
}
async function deployCurrent() {
  if (!definition.value || deploymentLoading.value || deploymentId.value || freezeOutcomeUnknown.value) return;
  const requestedBusinessId = businessId.value;
  const generation = businessRouteGeneration;
  if (!deploymentBindings.value.localDeviceId) { ElMessage.warning('请选择本机终端'); return; }
  if (hasTarget.value && !deploymentBindings.value.targetDeviceId) { ElMessage.warning('请选择对端终端'); return; }
  if (hasTarget.value && deploymentBindings.value.localDeviceId === deploymentBindings.value.targetDeviceId) {
    ElMessage.warning('本机与对端必须选择不同终端'); return;
  }
  deploymentLoading.value = true;
  deploymentNotice.value = null;
  deploymentValidation.value = null;
  let requestStarted = false;
  try {
    if (dirty.value) {
      deploymentNotice.value = { type: 'warning', message: '当前草稿尚未保存。请关闭弹窗，保存后再部署。' };
      return;
    }
    if (!await validate()) {
      deploymentValidation.value = validation.value;
      if (!deploymentValidation.value && validationError.value) deploymentNotice.value = { type: 'error', message: validationError.value };
      return;
    }
    if (dirty.value || validation.value?.ok !== true) {
      deploymentNotice.value = { type: 'warning', message: dirty.value ? '校验期间草稿发生变化，请保存后重新部署。' : '草稿校验未通过，请修复问题后重试。' };
      deploymentValidation.value = validation.value;
      return;
    }
    if (generation !== businessRouteGeneration || requestedBusinessId !== businessId.value) return;
    const bindings = { expectedRevision: revision.value, localDeviceId: deploymentBindings.value.localDeviceId,
      targetDeviceId: hasTarget.value ? deploymentBindings.value.targetDeviceId : undefined };
    requestStarted = true;
    const result = dataOf(await deployBusiness(requestedBusinessId, bindings));
    if (generation !== businessRouteGeneration || requestedBusinessId !== businessId.value) return;
    if (!isDeploymentFrozen(result.deployment, requestedBusinessId, bindings)) throw new Error('部署回执与本次请求不一致');
    freezeResult.value = result.deployment;
    deploymentId.value = result.deployment.deploymentId;
    if (!isInstallResult(result.installation, deploymentId.value, result.deployment)) throw new Error('设备下发结果无效，请查看部署详情');
    installResult.value = result.installation;
    writeFreezeOutcomeUnknown(requestedBusinessId, false);
    deploymentNotice.value = { type: result.installation.failed || result.installation.offline ? 'warning' : 'success',
      message: `部署结果：成功 ${result.installation.succeeded}，等待上线 ${result.installation.offline}，失败 ${result.installation.failed}` };
  } catch (cause: any) {
    if (generation !== businessRouteGeneration || requestedBusinessId !== businessId.value) return;
    const httpStatus = cause?.response?.status;
    if (requestStarted && !deploymentId.value && !cause?.apiResponse && (!Number.isInteger(httpStatus) || httpStatus >= 500)) {
      freezeOutcomeUnknown.value = true;
      writeFreezeOutcomeUnknown(requestedBusinessId, true);
    }
    deploymentNotice.value = { type: 'error', message: cause.message || '部署失败' };
  } finally { if (generation === businessRouteGeneration) deploymentLoading.value = false; }
}
async function copyFreezeCredential() {
  const credential = freezeResult.value?.credential;
  if (!credential) return;
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(credential);
    } else {
      const input = document.createElement('textarea');
      input.value = credential;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand('copy');
      input.remove();
      if (!copied) throw new Error('浏览器拒绝访问剪贴板');
    }
    ElMessage.success('凭据已复制');
  } catch {
    ElMessage.error('复制失败，请手动选中凭据并复制；平台不会再次返回此凭据');
  }
}
function openDeployment() { deploymentVisible.value = false; router.push(deploymentId.value ? { name: 'SduiDeploymentDetail', params: { deploymentId: deploymentId.value } } : { name: 'SduiDeployments', query: { businessId: businessId.value } }); }
async function openDeploymentWizard() {
  installResult.value = null; freezeResult.value = null; deploymentId.value = '';
  deploymentNotice.value = null; deploymentValidation.value = null;
  deploymentVisible.value = true;
  try { devices.value = await loadAllClaimedDevices(); }
  catch (error: any) { catalogErrors.value.devices = `终端列表：${error.message || '读取失败'}`; }
}
async function focusLocation(location: string) {
  const flowMatch = location.match(/flows\[([^\]]+)\]/);
  const stepMatch = location.match(/steps\[(\d+)\]/);
  const flowIndex = flowMatch ? resolveFlowIndex(flowMatch[1]) : -1;
  if (flowIndex >= 0 && definition.value) {
    const flow = definition.value.flows[flowIndex];
    selectedFlowKey.value = flow.key;
    selectedStepIndex.value = stepMatch ? Number(stepMatch[1]) : -1;
  }
  if (/^uis\[/.test(location)) {
    showResources.value = true;
    await nextTick();
  } else if (/^(description|devices\.|mirror)/.test(location)) {
    settingsVisible.value = true;
    await nextTick();
  }
  const exact = findValidationTarget(location);
  const displayedFieldMatch = location.match(/^flows\[([^\]]+)\]\.steps\[(\d+)\]\.ui\.fields\.(.+)$/);
  let displayedFieldTarget: HTMLElement | null = null;
  if (displayedFieldMatch && definition.value) {
    const [, flowRef, rawStepIndex, fieldPath] = displayedFieldMatch;
    const flowIndex = resolveFlowIndex(flowRef);
    const uiKey = definition.value.flows[flowIndex]?.steps[Number(rawStepIndex)]?.ui;
    const uiIndex = definition.value.uis.findIndex((ui) => ui.key === uiKey);
    if (uiIndex >= 0) displayedFieldTarget = findValidationTarget(`uis[${uiIndex}].fields.${fieldPath}`);
  }
  const ancestorTarget = exact || displayedFieldTarget ? null : findValidationAncestor(location);
  const uiMatch = location.match(/uis\[(\d+)\]/);
  const fallbackPath = uiMatch ? `uis[${uiMatch[1]}]`
    : stepMatch && flowIndex >= 0 ? `flows[${flowIndex}].steps[${stepMatch[1]}]`
      : flowIndex >= 0 ? `flows[${flowIndex}]` : '';
  const target = exact || displayedFieldTarget || ancestorTarget || (fallbackPath ? findValidationTarget(fallbackPath) : null);
  if (!target) {
    ElMessage.info(`配置位置：${location}`);
    return;
  }
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('validation-focus');
  window.setTimeout(() => target.classList.remove('validation-focus'), 1800);
  if (!exact && !displayedFieldTarget && ancestorTarget) ElMessage.info(`已定位到最近的可编辑区域：${location}`);
  else if (!exact && !displayedFieldTarget) ElMessage.info(`已定位到所属配置卡片：${location}`);
  window.setTimeout(() => {
    const control = target.matches('input,textarea,button,[tabindex]')
      ? target
      : target.querySelector<HTMLElement>('input,textarea,.el-select__wrapper,.el-input__wrapper,button,[tabindex]');
    control?.focus({ preventScroll: true });
  }, 250);
}

function resolveFlowIndex(rawIndexOrKey: string): number {
  if (/^\d+$/.test(rawIndexOrKey)) return Number(rawIndexOrKey);
  return definition.value?.flows.findIndex(flow => flow.key === rawIndexOrKey) ?? -1;
}

function findValidationTarget(path: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-validation-path]'))
    .find(element => element.dataset.validationPath === path) || null;
}

function validationProblemKey(problem: ValidationProjection['problems'][number]): string {
  return `${problem.code}:${problem.location}`;
}

function findValidationAncestor(path: string): HTMLElement | null {
  let candidate = path;
  while (candidate.includes('.')) {
    candidate = candidate.slice(0, candidate.lastIndexOf('.'));
    const target = findValidationTarget(candidate);
    if (target) return target;
  }
  return null;
}

function converterTarget(problem: ValidationProjection['problems'][number]) {
  if (!problem.converter || !definition.value) return null;
  const match = problem.location.match(/^flows\[([^\]]+)\]\.steps\[(\d+)\]\.(with|bind)\.([^.]+)$/);
  if (!match) return null;
  const [, flowIndexOrKey, rawStepIndex, targetKind, targetName] = match;
  const flowIndex = resolveFlowIndex(flowIndexOrKey);
  const flow = definition.value.flows[flowIndex];
  const stepIndex = Number(rawStepIndex);
  const step = flow?.steps[stepIndex];
  const sourceReference = step?.[targetKind]?.[targetName];
  if (typeof sourceReference !== 'string' || !sourceReference.startsWith('@')) return null;
  return { flowKey: flow.key, stepIndex, targetKind: targetKind as 'with' | 'bind', targetName, sourceReference };
}

async function insertSuggestedConverter(problem: ValidationProjection['problems'][number]) {
  const target = converterTarget(problem);
  if (!target) return;
  try {
    const flow = definition.value?.flows.find(item => item.key === target.flowKey);
    const consumer = flow?.steps[target.stepIndex];
    if (!flow || !consumer) return;
    const usedOutputs = new Set(flow.steps.flatMap(step => Object.values(step.produces || {})));
    const baseOutput = `${target.flowKey}.${target.stepIndex}.converted`;
    let output = baseOutput;
    let suffix = 1;
    while (usedOutputs.has(`@${output}`)) output = `${baseOutput}.${suffix++}`;
    const converter = problem.converter!;
    const inputSlot = converter === 'ai.stt' ? 'audio' : 'text';
    const outputSlot = converter === 'ai.stt' ? 'text' : 'audio';
    const reference = `@${output}`;
    const inserted: BusinessFlow['steps'][number] = { action: converter, with: { [inputSlot]: target.sourceReference }, produces: { [outputSlot]: reference } };
    if (target.targetKind === 'with') consumer.with[target.targetName] = reference;
    else consumer.bind[target.targetName] = reference;
    flow.steps.splice(target.stepIndex, 0, inserted); markDirty();
    ElMessage.success(`已在第 ${target.stepIndex + 1} 步前插入 ${problem.converter}`);
  } catch (cause: any) {
    ElMessage.error(cause.message || '插入转换步骤失败');
  }
}

onMounted(async () => {
  window.addEventListener('beforeunload', handleBeforeUnload);
  await loadReferenceData();
  await load();
  if (definition.value && businessId.value) await validate();
  if (definition.value && route.query.deploy === '1') await openDeploymentWizard();
});

watch(businessId, async (id, previousId) => {
  if (!id || id === previousId) return;
  clearUiStructuredState();
  businessRouteGeneration++;
  businessLoadGeneration++;
  resourceRequestGeneration++;
  saving.value = false;
  deploymentLoading.value = false;
  definition.value = null;
  revision.value = 0;
  validation.value = null;
  validationError.value = '';
  loadError.value = '';
  resources.value = null;
  resourcesLoading.value = false;
  resourcesError.value = '';
  dirty.value = false;
  editRevision = 0;
  deploymentVisible.value = false;
  deploymentId.value = '';
  freezeOutcomeUnknown.value = readFreezeOutcomeUnknown(id);
  installResult.value = null;
  await load();
  if (definition.value && id === businessId.value) await validate();
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
});
</script>

<style scoped lang="scss">
.page-heading,.section-heading,.flow-header,.resource-title { display:flex; align-items:center; justify-content:space-between; gap:16px; }
.deployment-notice { margin-bottom: 16px; }.deployment-form { display:grid; grid-template-columns:1fr 1fr; gap:14px; }.deployment-form :deep(.el-select) { width:100%; }.trigger-values{display:grid;gap:6px;width:100%}.trigger-value{display:grid;grid-template-columns:1fr 1fr 2fr auto;gap:6px}.trigger-schema-help{color:#667085}.credential-note{margin-top:16px}.credential-value{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.credential-note code{word-break:break-all;user-select:all}.credential-note p{margin:6px 0 0}
.resource-drawer-header { display:flex; align-items:center; justify-content:space-between; width:100%; }
.page-heading { margin-bottom:22px; }.page-heading h1 { margin:12px 0 4px; color:#182230; font-size:25px; }.page-heading p,.section-heading p { margin:0; color:#667085; }.draft-status { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }.heading-actions { display:flex; gap:8px; }.reference-device{width:210px}.metadata-card { margin-bottom:28px; }.metadata-form { display:grid; grid-template-columns:2fr 3fr 2fr 1fr; gap:14px; }.mirror-control{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.section-heading { margin:28px 0 14px; }.section-heading h2 { margin:0 0 5px; font-size:18px; }.resource-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(270px,1fr)); gap:12px; }.resource-title>div { display:flex; align-items:center; gap:8px; }.resource-grid p,.entry-line { color:#667085; font-size:13px; }.ui-settings { display:grid; grid-template-columns:2fr 1fr; gap:8px; }.ui-field { display:grid; gap:5px; margin:12px 0; }.ui-field label,.step-params label,.array-item label { color:#475467; font-size:12px; }.ui-field small { color:#98a2b3; }.array-field{display:grid;gap:8px;margin:16px 0;padding:12px;border:1px solid #eaecf0;border-radius:8px}.array-header{display:flex;justify-content:space-between;align-items:center}.array-item{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;gap:10px;padding:8px;background:#f8fafc;border-radius:6px}.array-item label{display:grid;gap:5px}.flow-list { display:grid; gap:14px; }.flow-header>div { display:flex; align-items:center; gap:10px; }.flow-actions { flex-wrap:wrap; justify-content:flex-end; }.flow-index,.step-number { color:#98a2b3; font-variant-numeric:tabular-nums; }.flow-key { width:210px; }.entry-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; padding:8px 12px; background:#f8fafc; }.entry-grid :deep(.el-form-item) { margin-bottom:8px; }.step-list { display:grid; gap:8px; }.step-row { display:flex; align-items:flex-start; gap:14px; padding:12px; border:1px solid #eaecf0; border-radius:7px; }.step-content { display:grid; flex:1; grid-template-columns:minmax(200px,2fr) minmax(130px,1fr); gap:10px; min-width:0; }.step-actions { display:flex; flex-direction:column; }.step-params { display:grid; grid-column:1/-1; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:10px; }.step-params label { display:grid; gap:5px; }.option-detail { float:right; max-width:260px; overflow:hidden; color:#98a2b3; text-overflow:ellipsis; }.problems-table { margin-top:14px; }.problems-table small { display:block; margin-top:4px; color:#667085; }
.ui-field small.limit-exceeded,.array-item small.limit-exceeded { color:#d92d20; font-weight:600; }
.slot-reassignment-alert { margin: 12px 0; }
.flow-header>div { flex-wrap:wrap; }.screen-label{color:#667085;font-size:12px}.flow-screen{width:190px}
.validation-focus { scroll-margin-top: 96px; outline: 2px solid #f79009 !important; outline-offset: 3px; background-color: #fffaeb !important; transition: background-color .2s ease, outline-color .2s ease; }
.editor-topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:20px;margin:-20px -20px 18px;padding:12px 20px;border-bottom:1px solid #eaecf0;background:rgba(255,255,255,.96);backdrop-filter:blur(10px)}.business-title{min-width:240px}.business-name-input{max-width:420px;margin:5px 0}.business-name-input :deep(input){height:34px;padding:0;border:0;background:transparent;font-size:21px;font-weight:650;box-shadow:none}.business-title :deep(.el-breadcrumb){font-size:12px}.draft-status{display:flex;align-items:center;gap:8px;color:#667085;font-size:12px}.heading-actions{align-items:center;flex-wrap:wrap;justify-content:flex-end}.business-canvas{display:grid;grid-template-columns:minmax(420px,1.65fr) minmax(330px,1fr);align-items:start;gap:16px;min-height:520px}.flow-column,.detail-column{min-width:0}.detail-column{position:sticky;top:90px;max-height:calc(100vh - 110px);overflow:auto}.flow-section-heading{margin:0 0 12px}.flow-section-heading p{font-size:13px}.flow-list{display:grid;gap:12px}.flow-card{border-color:#dfe3eb;cursor:pointer;transition:border-color .15s,box-shadow .15s}.flow-card:hover{border-color:#9dbbf5}.flow-card-selected{border-color:#409eff;box-shadow:0 0 0 1px #409eff}.flow-card :deep(.el-card__header){padding:12px 16px}.flow-card :deep(.el-card__body){padding:12px 16px}.flow-header,.flow-heading-main,.flow-actions,.flow-screen-row{display:flex;align-items:center;gap:10px}.flow-header{justify-content:space-between}.flow-heading-main{min-width:0;flex-wrap:wrap}.flow-heading-main strong{font-size:15px}.flow-screen-row{min-height:40px;margin:0 0 8px;padding:6px 10px;border-radius:6px;background:#f8fafc}.flow-screen-row>span{flex:none;color:#667085;font-size:12px}.flow-screen{width:min(240px,60%)}.step-list{display:grid;gap:6px}.step-summary{display:grid;grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:42px;padding:7px 10px;border:1px solid #eaecf0;border-radius:6px;background:white;cursor:pointer}.step-summary:hover{border-color:#98b7ef;background:#f8fbff}.step-summary-selected{border-color:#6a9cf0;background:#eff6ff}.step-number{font-size:12px}.step-action{overflow:hidden;text-overflow:ellipsis;font-weight:550}.step-summary small{grid-column:2/-1;color:#667085}.continuation-row{padding:7px 12px;border-left:2px solid #98a2b3;color:#667085;font-size:12px}.add-step-button{justify-self:start;margin-top:3px}.detail-card{min-height:380px}.detail-card :deep(.el-card__header){padding:13px 16px}.detail-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}.detail-heading strong{display:block;font-size:15px}.detail-heading small{display:block;margin-top:3px;color:#667085;font-size:12px}.detail-form :deep(.el-form-item){margin-bottom:14px}.detail-form :deep(.el-select),.detail-form :deep(.el-input-number){width:100%}.detail-form :deep(.el-form-item__label){padding-bottom:4px}.detail-help{color:#667085;font-size:12px}.detail-step-title{display:flex;align-items:center;justify-content:space-between;margin:-4px 0 10px;color:#475467;font-size:13px;font-weight:600}.detail-param{display:grid;width:100%;gap:6px}.resource-drawer-header{display:flex;align-items:center;justify-content:space-between;width:100%}.resource-drawer-header>div{display:flex;gap:8px}.resource-drawer-header+ .el-alert{margin-bottom:14px}.resource-grid{grid-template-columns:repeat(auto-fill,minmax(320px,1fr));margin:12px 0 24px}.section-heading{margin:20px 0 10px}
@media(max-width:1000px){.business-canvas{grid-template-columns:1fr}.detail-column{position:static;max-height:none;overflow:visible}.editor-topbar{align-items:flex-start;flex-direction:column}.heading-actions{justify-content:flex-start;width:100%}}
@media(max-width:800px) { .page-heading { align-items:flex-start; flex-direction:column; }.metadata-form { grid-template-columns:1fr 1fr; }.step-content { grid-template-columns:1fr; }.step-params { grid-column:auto; }.editor-topbar{margin:-12px -12px 14px;padding:10px 12px}.business-canvas{grid-template-columns:minmax(0,1fr)}.flow-header{align-items:flex-start;flex-direction:column}.flow-actions{align-self:flex-end}.flow-screen-row{flex-wrap:wrap}.flow-screen{flex:1;min-width:130px}.resource-grid{grid-template-columns:1fr} }
</style>
