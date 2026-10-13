<template>
  <div class="app-container debug-workbench" v-loading="loading">
    <header class="hero">
      <div class="hero-heading"><h1>终端调试台</h1><el-tag v-if="available" :type="available.online ? 'success' : 'info'" effect="light" round>{{ available.online ? '在线' : '离线' }}</el-tag></div>
      <div class="device-picker">
        <el-select v-model="deviceId" filterable aria-label="选择终端" placeholder="选择终端" :disabled="sending || audioLoading || recordingSending" @change="onDeviceChange">
          <el-option v-for="device in devices" :key="device.deviceId" :label="`${device.name || device.deviceId} · ${device.status === 'ONLINE' ? '在线' : '离线'}`" :value="device.deviceId"/>
        </el-select>
        <el-button :loading="loadingDevices" :disabled="sending || audioLoading || recordingSending" @click="loadDevices">刷新终端</el-button>
      </div>
    </header>
    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon/>
    <el-alert v-if="deviceListError" :type="devices.length ? 'warning' : 'error'" :closable="false" :title="deviceListError" show-icon/>
    <el-alert v-if="available && !available.online" type="warning" :closable="false" title="终端离线，暂时无法发送操作。" show-icon/>
    <div v-if="!deviceId" class="debug-idle">
      <el-empty description="选择终端开始调试">
        <el-button type="primary" :loading="loadingDevices" @click="loadDevices">刷新终端列表</el-button>
      </el-empty>
    </div>
    <div v-if="deviceId" class="debug-layout">
      <main class="workspace">
        <div class="workspace-columns">
          <div class="compact-column">
            <section class="device-controls" aria-label="设备控制">
              <div class="workspace-heading">
                <h2>设备控制</h2>
                <el-button link type="primary" :loading="requestDirectoryLoading" @click="loadRequests">刷新能力</el-button>
              </div>
              <el-alert v-if="requestDirectoryError" type="error" :closable="false" :title="requestDirectoryError" show-icon/>
              <el-skeleton v-if="requestDirectoryLoading && !available" :rows="4" animated/>
              <template v-else-if="available">
                <div v-if="deviceActionCards.length" class="action-grid">
                  <section v-for="action in deviceActionCards" :key="action.name" class="control-card" :class="{ 'control-card-wide': action.wide }">
                    <el-form v-if="action.formParams.length" label-position="top" class="control-form">
                      <el-form-item v-for="param in action.formParams" :key="param.name" :label="actionParameterLabel(action.name, param)" :required="param.required" :error="actionErrors[action.name]?.[param.name]">
                        <el-select v-if="param.values?.length" v-model="actionValues[action.name][param.name]">
                          <el-option v-for="value in param.values" :key="String(value)" :label="String(value)" :value="value"/>
                        </el-select>
                        <el-input-number v-else-if="isNumericParameter(param)" v-model="actionValues[action.name][param.name]" :precision="['int','integer'].includes(param.type) ? 0 : undefined" :min="param.min ?? undefined" :max="param.max ?? undefined" :controls="false" placeholder="数值"/>
                        <el-switch v-else-if="param.type === 'boolean'" v-model="actionValues[action.name][param.name]"/>
                        <el-input v-else v-model="actionValues[action.name][param.name]" :placeholder="param.required ? '请输入' : '可选'"/>
                      </el-form-item>
                    </el-form>
                    <p v-if="action.parametersUnavailable" class="field-error">参数未就绪</p>
                    <div class="control-action">
                      <el-button type="primary" :disabled="!available.online || sending || Boolean(action.parametersUnavailable)" :loading="sendingAction === action.name" @click="submitAction(action)">{{ actionLabel(action.name) }}</el-button>
                    </div>
                  </section>
                </div>
                <template v-if="shortcutActions.length">
                  <p class="shortcut-hint">快捷指令</p>
                  <div class="action-grid action-grid-compact">
                    <section v-for="action in shortcutActions" :key="action.name" class="control-card control-card-plain">
                      <div class="control-action">
                        <el-button size="small" :type="['system.reboot','business.reset'].includes(action.name) ? 'danger' : 'default'" :plain="['system.reboot','business.reset'].includes(action.name)" :disabled="!available.online || sending" :loading="sendingAction === action.name" @click="submitAction(action)">{{ actionLabel(action.name) }}</el-button>
                      </div>
                    </section>
                  </div>
                </template>
                <el-empty v-if="!deviceActionCards.length && !shortcutActions.length" description="终端暂无可调试的操作"/>
              </template>
              <el-empty v-else-if="!requestDirectoryLoading" description="设备能力读取失败"/>
            </section>
            <section class="light-controls" aria-label="灯光控制">
              <div class="workspace-heading"><h2>灯光控制</h2></div>
              <div v-for="action in lightActions" :key="action.name" class="light-control">
                <el-form label-position="top" class="control-form rgb-form">
                  <div class="rgb-row">
                    <el-form-item label="灯光模式" class="rgb-mode">
                      <el-select v-model="actionValues[action.name].mode">
                        <el-option v-for="mode in lightModes" :key="mode.value" :label="mode.label" :value="mode.value"/>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="颜色" class="rgb-color">
                      <el-color-picker :model-value="rgbColor(action.name)" :predefine="['#ff0000','#00ff00','#0000ff','#ffffff','#ff9900','#00ffff','#ff00ff']" @change="setRgbColor(action.name, $event)"/>
                    </el-form-item>
                    <el-form-item label="亮度" class="rgb-brightness">
                      <el-input-number v-model="actionValues[action.name].brightness" :min="0" :max="100" :precision="0" controls-position="right"/>
                    </el-form-item>
                    <div class="control-actions">
                      <el-button type="primary" :disabled="!available?.online || sending" :loading="sendingAction === action.name" @click="submitAction(action)">应用</el-button>
                      <el-button v-if="rgbOffAction" :disabled="!available?.online || sending" :loading="sendingAction === rgbOffAction.name" @click="submitAction(rgbOffAction)">关闭</el-button>
                    </div>
                  </div>
                </el-form>
              </div>
              <el-button v-if="!lightActions.length && rgbOffAction" :disabled="!available?.online || sending" :loading="sendingAction === rgbOffAction.name" @click="submitAction(rgbOffAction)">关闭灯光</el-button>
              <p v-else-if="!lightActions.length" class="muted capability-empty">{{ requestDirectoryLoading ? '正在读取灯光能力…' : '终端未声明灯光控制能力' }}</p>
            </section>
            <el-card shadow="never" class="section-debug-card">
              <template #header>
                <div class="card-header">
                  <span>UI 展示</span>
                </div>
              </template>
              <el-alert v-if="sectionCatalogError" type="error" :closable="false" :title="sectionCatalogError"/>
              <el-button v-if="sectionCatalogError" link type="primary" @click="loadSectionCatalog">重试加载模板</el-button>
              <div class="section-editor-layout">
                <el-form label-position="top">
                  <el-form-item label="模板">
                    <el-select v-model="sectionType" @change="resetSectionFields">
                      <el-option v-for="item in availableSectionTemplates" :key="item.type" :label="`${item.displayName}${supportedSectionTypes?.includes(item.type) ? '' : '（终端未声明支持）'}`" :value="item.type"/>
                    </el-select>
                  </el-form-item>
                  <div class="section-preview">
                    <h4>页面预览</h4>
                    <div class="device-preview" :class="{'gauge-device-preview': sectionType === 'gauge_section'}">
                      <strong class="section-preview-title">
                        <ScrollingText :text="sectionValues.title || '终端显示'"/>
                      </strong>
                      <ChartSectionPreview v-if="isChartSection(sectionType)" :type="sectionType" :fields="sectionValues"/>
                      <p v-else-if="sectionType==='text_section'">{{ sectionValues.text || '正文内容预览' }}</p>
                      <p v-else-if="sectionType==='status_section'">
                        <ScrollingText :text="sectionValues.value || '状态值'"/>
                        <small>{{ sectionValues.description || '' }}</small>
                      </p>
                      <ul v-else>
                        <li v-for="(row,index) in sectionRows" :key="index">
                          <ScrollingText :text="String(row.label || row.value || '')"/>
                          <ScrollingText v-if="sectionType==='metrics_section'" :text="`${row.value || ''}${row.unit || ''}`"/>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <template v-if="sectionType==='text_section'">
                    <el-form-item label="标题（可选）" :error="sectionFieldErrors.title">
                      <el-input v-model="sectionValues.title" maxlength="64" placeholder="输入显示标题"/>
                    </el-form-item>
                    <el-form-item label="正文" :error="sectionFieldErrors.text">
                      <el-input v-model="sectionValues.text" type="textarea" :rows="2" maxlength="240" show-word-limit placeholder="输入要显示在终端上的正文"/>
                    </el-form-item>
                  </template>
                  <ChartSectionEditor v-else-if="isChartSection(sectionType)" :type="sectionType" :fields="sectionValues" @change="updateChartFields"/>
                  <template v-else>
                    <el-form-item v-for="field in currentSectionFields" :key="field.name" :label="field.label || field.name" :error="sectionFieldErrors[field.name]">
                      <el-select v-if="field.options?.length" v-model="sectionValues[field.name]">
                        <el-option v-for="option in field.options" :key="option" :label="option" :value="option"/>
                      </el-select>
                      <el-input-number v-else-if="['int','integer','number'].includes(field.type)" v-model="sectionValues[field.name]" :min="field.min ?? undefined" :max="field.max ?? undefined"/>
                      <el-input v-else v-model="sectionValues[field.name]" :maxlength="field.max ?? undefined" :placeholder="field.required ? '必填' : '可选'"/>
                    </el-form-item>
                  </template>
                  <section v-if="arrayField" class="section-array-editor">
                    <div class="array-editor-title">
                      <strong>{{ arrayField.label }}</strong>
                      <el-button size="small" @click="addSectionRow">添加一项</el-button>
                    </div>
                    <el-form-item v-for="(row,index) in sectionRows" :key="index" :label="`${arrayField.label} ${index+1}`">
                      <div class="section-row">
                        <el-input-number v-if="sectionType==='chart_section'" v-model="sectionRows[index].value" :min="-32768" :max="32767" :step="1"/>
                        <template v-else>
                          <el-input v-for="child in arrayField.children" :key="child.name" v-model="sectionRows[index][child.name]" :placeholder="child.label" :maxlength="child.max ?? undefined"/>
                        </template>
                        <el-button text type="danger" @click="removeSectionRow(index)">删除</el-button>
                      </div>
                    </el-form-item>
                    <small v-if="sectionFieldErrors[arrayField.name]" class="field-error">{{ sectionFieldErrors[arrayField.name] }}</small>
                  </section>
                  <el-button type="primary" class="section-submit" :disabled="!available?.online || sending || !sectionCapabilityReady || !supportedSectionTypes?.includes(sectionType)" :loading="sectionSending" @click="publishSection">下发到终端</el-button>
                  <template v-if="sectionCapabilityError">
                    <el-alert type="error" :closable="false" :title="`终端模板能力读取失败：${sectionCapabilityError}`"/>
                    <el-button link type="primary" @click="loadDeviceContext">重试读取能力</el-button>
                  </template>
                  <el-alert v-else-if="!sectionCapabilityReady" type="warning" :closable="false" title="正在读取终端模板能力；能力确认前不能下发。"/>
                  <el-alert v-else-if="!supportedSectionTypes?.includes(sectionType)" type="warning" :closable="false" :title="`终端未声明支持${sectionCatalog[sectionType]?.displayName || sectionType}模板`"/>
                </el-form>
              </div>
            </el-card>
            <section class="audio-tools" aria-label="音频控制">
              <div class="audio-workbench-row">
                <section class="audio-debug-card">
                  <h2>音频控制</h2>
                  <div class="audio-source-row">
                    <el-radio-group v-model="audioSource" :disabled="audioLoading">
                      <el-radio-button value="text">文本转语音</el-radio-button>
                      <el-radio-button value="file">音频文件</el-radio-button>
                      <el-radio-button value="tone">提示音</el-radio-button>
                    </el-radio-group>
                    <el-button v-if="audioSource==='text'" type="primary" :disabled="!available?.online || !audioText.trim()" :loading="audioLoading" @click="playTts">合成并播放</el-button>
                    <el-button v-else-if="audioSource==='file'" type="primary" :disabled="!available?.online || !audioFile" :loading="audioLoading" @click="playAudioFile">播放文件</el-button>
                    <div v-else class="shortcut-actions">
                      <el-button :disabled="!available?.online || audioLoading" :loading="audioToneLoading==='short'" @click="playTestTone('short')">短提示音</el-button>
                      <el-button :disabled="!available?.online || audioLoading" :loading="audioToneLoading==='double'" @click="playTestTone('double')">双提示音</el-button>
                      <el-button :disabled="!available?.online || audioLoading" :loading="audioToneLoading==='low'" @click="playTestTone('low')">低音提示</el-button>
                    </div>
                  </div>
                  <el-form label-position="top">
                    <el-form-item v-if="audioSource==='text'" label="播放文本">
                      <el-input v-model="audioText" type="textarea" :rows="2" maxlength="500" show-word-limit placeholder="输入要在终端播放的文本" @keydown.ctrl.enter.prevent="playTts" @keydown.meta.enter.prevent="playTts"/>
                    </el-form-item>
                    <el-form-item v-else-if="audioSource==='file'" label="音频文件">
                      <input type="file" accept="audio/*" aria-label="选择音频文件" :disabled="audioLoading" @change="selectAudioFile"/>
                    </el-form-item>
                  </el-form>
                </section>
                <section v-if="recordingSupported" class="recording-card">
                  <h2>音频采集</h2>
                  <div class="recording-controls">
                    <el-button v-if="!recordingActive" :disabled="!available?.online" :loading="recordingSending || recordingTranscribing" @click="startRecording">开始录音</el-button>
                    <el-button v-else type="danger" :loading="recordingSending || recordingTranscribing" @click="stopRecording">停止录音</el-button>
                    <span v-if="recordingStatus" role="status">{{ recordingStatus }}</span>
                  </div>
                  <p v-if="recordingTranscribing" role="status">正在识别文字…</p>
                  <el-form v-if="recordingText" label-position="top">
                    <el-form-item label="识别文本">
                      <el-input :model-value="recordingText" type="textarea" readonly :rows="3"/>
                    </el-form-item>
                  </el-form>
                  <details v-if="recordingArtifact" class="technical-details">
                    <summary>录音资源</summary>
                    <code>{{ recordingArtifact }}</code>
                  </details>
                  <el-alert v-if="recordingError" type="warning" :closable="false" :title="recordingError" show-icon/>
                </section>
              </div>
            </section>
          </div>
          <div class="canvas-column">
            <el-card shadow="never" class="canvas-debug-card frame-debug-card">
              <template #header>
                <div class="card-header">
                  <span>Canvas 画板</span>
                  <span class="canvas-resolution">{{ frameSpec.width }} × {{ frameSpec.width }} 像素 · {{ frameSpec.maxFps }} fps</span>
                </div>
              </template>
              <el-alert v-if="frameCapabilityError" type="warning" :closable="false" :title="frameCapabilityError"/>
              <el-alert v-if="frameSpecError" type="error" :closable="false" :title="frameSpecError"/>
              <div v-if="viewStateError" class="frame-state-warning">
                <el-alert type="warning" :closable="false" :title="`视图状态读取失败：${viewStateError}。编辑和新传输仍可继续。`"/>
                <el-button link type="primary" @click="loadViewState">重试读取状态</el-button>
              </div>
              <el-form label-position="top">
                <div class="canvas-editor-layout">
                  <div class="pixel-editor">
                    <div class="pixel-toolbar">
                      <div>
                        <el-button size="small" :disabled="sending || !drawingStrokes.length" @click="undoPixelStroke">撤销上一笔</el-button>
                        <el-button size="small" :disabled="sending" @click="clearPixelBoard">清空画布</el-button>
                      </div>
                    </div>
                    <div class="pixel-grid-layout">
                      <div class="pixel-ruler-top">
                        <span v-for="mark in pixelGridMarks" :key="`x-${mark}`" :style="{left:`${mark/frameSpec.width*100}%`}">{{ mark }}</span>
                      </div>
                      <div class="pixel-ruler-left">
                        <span v-for="mark in pixelGridMarks" :key="`y-${mark}`" :style="{top:`${mark/frameSpec.width*100}%`}">{{ mark }}</span>
                      </div>
                      <div class="pixel-board-wrap" :style="{backgroundColor:canvasBackgroundColor}">
                        <canvas ref="pixelBoard" class="pixel-board" :width="frameSpec.width" :height="frameSpec.width" :aria-label="`${frameSpec.width}乘${frameSpec.width}像素网格画板`" @pointerdown="startPixelStroke" @pointermove="continuePixelStroke" @pointerup="finishPixelStroke" @pointercancel="finishPixelStroke"/>
                        <svg class="pixel-grid-overlay" :viewBox="`0 0 ${frameSpec.width} ${frameSpec.width}`" preserveAspectRatio="none" aria-hidden="true">
                          <path :d="pixelGridPath"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div class="canvas-settings">
                    <h3 class="canvas-settings-heading">画布与画笔</h3>
                    <dl class="canvas-meta">
                      <div><dt>画布</dt><dd>{{ frameSpec.width }} × {{ frameSpec.width }}</dd></div>
                      <div><dt>调色板</dt><dd>{{ parsedPalette.length }} 色{{ paletteBits(parsedPalette.length) ? ` · ${paletteBits(parsedPalette.length)} bit` : '' }}</dd></div>
                      <div><dt>单帧约</dt><dd>{{ canvasFrameBytes === null ? '—' : `${(canvasFrameBytes / 1024).toFixed(1)} KiB` }}</dd></div>
                      <div><dt>画笔</dt><dd>{{ brushSize }} px</dd></div>
                    </dl>
                    <div class="dimensions">
                      <el-form-item label="画布分辨率">
                        <el-select v-model="frameSpec.width" :disabled="frameSessionOpen || sending" @change="setPixelResolution">
                          <el-option v-for="size in frameOptions" :key="size" :label="`${size} × ${size} 像素`" :value="size">
                            {{ size }} × {{ size }}
                          </el-option>
                        </el-select>
                      </el-form-item>
                    </div>
                    <el-form-item label="背景色" class="canvas-background-control">
                      <el-color-picker v-model="canvasBackgroundColor" :disabled="frameSessionOpen" :predefine="defaultPaletteColors" color-format="hex" @change="setCanvasBackgroundColor"/>
                    </el-form-item>
                    <el-form-item label="画笔颜色" class="canvas-palette-control">
                      <div class="palette-colors color-swatch-list">
                        <button v-for="color in defaultPaletteColors" :key="`brush-${color}`" type="button" class="palette-swatch" :class="{selected:paletteColors[selectedPaletteIndex].toLowerCase()===color.toLowerCase()}" :style="{backgroundColor:color}" :title="`选择画笔颜色 ${color}`" :aria-label="`选择画笔颜色 ${color}`" @click="setCanvasBrushColor(color)"/>
                        <el-color-picker :model-value="paletteColors[selectedPaletteIndex]" :disabled="frameSessionOpen" color-format="hex" @change="updatePaletteColor(selectedPaletteIndex,$event)"/>
                      </div>
                    </el-form-item>
                    <el-form-item label="画笔大小" class="canvas-brush-control">
                      <el-radio-group v-model="brushSize">
                        <el-radio-button :value="1">1 px</el-radio-button>
                        <el-radio-button :value="2">2 px</el-radio-button>
                        <el-radio-button :value="4">4 px</el-radio-button>
                      </el-radio-group>
                    </el-form-item>
                    <h3 class="canvas-settings-heading canvas-transfer-heading">终端发送</h3>
                    <el-form-item label="发送方式" class="canvas-send-control">
                      <el-radio-group v-model="canvasSendMode">
                        <el-radio-button value="final">最终画面</el-radio-button>
                        <el-radio-button value="process">绘制过程</el-radio-button>
                      </el-radio-group>
                    </el-form-item>
                    <el-form-item v-if="canvasSendMode==='process'" label="过程播放时长" class="canvas-duration-control">
                      <el-select v-model="playbackSeconds">
                        <el-option v-for="seconds in [2,4,8,12]" :key="seconds" :label="`${seconds} 秒`" :value="seconds"/>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="终端帧率上限" class="canvas-fps-control">
                      <el-input-number v-model="frameSpec.maxFps" :min="1" :max="30" :disabled="frameSessionOpen"/>
                    </el-form-item>
                    <el-progress v-if="canvasPlaybackActive" :percentage="canvasPlaybackProgress" :show-text="true"/>
                    <div class="frame-actions">
                      <el-button type="primary" :disabled="sending || (frameSessionOpen && frameMode!=='canvas') || !available?.online || Boolean(frameSpecError) || !pixelPixels.length" :loading="frameMode==='canvas' && frameSending && !canvasPlaybackActive" @click="sendPixelCanvas">{{ canvasSendMode==='final' ? '发送最终画面' : '播放绘制过程' }}</el-button>
                      <el-button v-if="canvasPlaybackActive" type="warning" @click="cancelCanvasPlayback">停止播放</el-button>
                      <el-button v-if="frameSessionOpen && frameMode==='canvas'" :disabled="sending || !canCompleteFrame" :loading="frameMode==='canvas' && frameSending" @click="completeFrame">关闭 Canvas</el-button>
                      <el-tag v-if="frameSessionOpen && frameMode==='canvas'" type="success">Canvas 会话已打开</el-tag>
                    </div>
                  </div>
                </div>
              </el-form>
            </el-card>
            <el-card shadow="never" class="image-debug-card frame-debug-card">
              <template #header>
                <div class="card-header">
                  <span>图片展示</span>
                </div>
              </template>
              <el-alert v-if="imageSpecError" type="error" :closable="false" :title="imageSpecError"/>
              <el-form label-position="top" class="image-form">
                <el-form-item label="选择图片" class="image-file-control">
                  <input type="file" accept="image/png,image/jpeg,image/webp" :disabled="sending || frameSessionOpen" @change="selectFrame"/>
                  <small v-if="frameFile">已选 {{ frameFile.name }} · {{ (frameFile.size/1024).toFixed(1) }} KiB</small>
                  <small v-else>支持 PNG / JPEG / WebP，超出画布比例时按所选模式裁剪</small>
                </el-form-item>
                <section v-if="frameFile" class="image-crop-editor">
                  <div class="image-crop-heading">
                    <strong>图片预览</strong>
                    <span>{{ imageSpec.width }} × {{ imageSpec.height }}</span>
                  </div>
                  <el-radio-group v-model="imageFitMode" size="small" class="image-fit-mode">
                    <el-radio-button value="contain">完整显示</el-radio-button>
                    <el-radio-button value="cover">铺满裁剪</el-radio-button>
                  </el-radio-group>
                  <canvas ref="imageCropCanvas" class="image-crop-preview" width="256" height="256" aria-label="图片方形裁剪预览" @pointerdown="startImageCropDrag" @pointermove="moveImageCrop" @pointerup="finishImageCropDrag" @pointercancel="finishImageCropDrag"/>
                  <small v-if="imagePreviewReady">拖动预览调整位置</small>
                  <el-form-item v-if="imagePreviewReady" label="裁剪缩放">
                    <el-slider :model-value="imageCropZoom" :min="1" :max="3" :step="0.1" :show-input="false" @input="setImageCropZoom"/>
                  </el-form-item>
                  <el-alert v-if="imageCropError" type="error" :closable="false" :title="imageCropError"/>
                </section>
                <div class="frame-actions">
                  <el-button type="primary" :disabled="sending || (frameSessionOpen && frameMode!=='image') || !available?.online || !frameFile || (frameSessionOpen && frameCount > 0) || Boolean(imageSpecError)" :loading="frameMode==='image' && frameSending" @click="uploadAndDisplayImage">{{ frameSessionOpen && frameMode==='image' ? '重试上传' : '上传并显示' }}</el-button>
                  <el-button v-if="canCompleteFrame && frameMode==='image'" :disabled="!canCompleteFrame" :loading="frameMode==='image' && frameSending" @click="completeFrame">完成图片</el-button>
                </div>
              </el-form>
            </el-card>
          </div>
        </div>
      </main>
      <DebugResultPanel :history="history" :selected="selectedHistory" :loading="historyLoading" :detail-loading="historyDetailLoading" :error="historyError" :detail-error="historyDetailError" :submitting="sendingAction || (sectionSending ? 'view.section' : '')" :submit-error="actionSubmitError" :audio-status="audioStatus" :audio-status-type="audioStatusType" :action-label="actionLabel" @refresh="loadHistory" @select="selectHistory"/>
    </div>
  </div>
</template>
<script setup lang="ts">
import DebugResultPanel from './components/DebugResultPanel.vue';
import { pixelPlaybackFrames, type PixelChange } from './utils/pixelPlayback';
import ChartSectionPreview from '../components/ChartSectionPreview.vue';
import ScrollingText from '../components/ScrollingText.vue';
import ChartSectionEditor from '../components/ChartSectionEditor.vue';
import { isChartSection, defaultChartFields, chartSectionError } from '../components/chartSections';
import { computed,nextTick,onBeforeUnmount,onMounted,reactive,ref,watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getSectionCatalog, parseSectionCatalog, type SectionField, type SectionTemplate } from '@/api/business';
import { completeDebugView,getDebugAvailableRequests,getDebugRequestDetail,getDebugRequestHistory,getDebugViewState,getDeviceCapabilitySchema,getDeviceList,publishDebugView,sendDebugRequest,sendDebugViewFrame,sendDebugTts,sendDebugTestTone,sendDebugAudio,getDebugRecordingResult } from '@/api/sdui';
import { isVisibleDirectCommand, supportsCapability } from '@/sdui/capabilityCatalog';
import type { DebugActionProjection, DebugAvailableRequests, DebugJournalEntry, DebugRequestResult, DebugViewState } from '@/types/sdui-debug';
const route=useRoute();
const router=useRouter();
type FrameCapabilities = {
  viewModes: string[] | null;
  resolutions: number[] | null;
  maxBytes: number | null;
  maxPaletteColors: number | null;
  colorBits: number[] | null;
};
const devices=ref<any[]>([]);const deviceId=ref('');const loading=ref(false);const loadingDevices=ref(false);const sending=ref(false);const error=ref('');const deviceListError=ref('');const available=ref<DebugAvailableRequests|null>(null);const requestDirectoryLoading=ref(false);const requestDirectoryError=ref('');const history=ref<DebugJournalEntry[]>([]);const historyLoading=ref(false);const historyError=ref('');const historyDetailLoading=ref(false);const historyDetailError=ref('');const requestName=ref('');const requestParams=ref<Record<string,unknown>>({});const requestJsonDrafts=ref<Record<string,string>>({});const requestParamErrors=ref<Record<string,string>>({});const selectedHistory=ref<DebugJournalEntry|DebugRequestResult|null>(null);const sectionCatalog=ref<Record<string,SectionTemplate>>({});const sectionCatalogError=ref('');const sectionType=ref('text_section');const sectionValues=reactive<Record<string,any>>({});const sectionRows=ref<Record<string,any>[]>([]);const sectionFieldErrors=ref<Record<string,string>>({});const supportedSectionTypes=ref<string[]|null>(null);const sectionCapabilityError=ref('');const sectionCapabilityReady=ref(false);const viewStateLoading=ref(false);const viewStateError=ref('');const frameSizes=[16,32,64,128];const frameCapabilities=ref<FrameCapabilities|null>(null);const frameCapabilityError=ref('');const frameOptions=computed(()=>frameCapabilities.value?.resolutions == null ? frameSizes : frameCapabilities.value.resolutions);const frameMode=ref<'image'|'canvas'>('image');const frameSpec=ref({width:128,height:128,maxFps:10});const imageSpec=ref({width:128,height:128});const imagePaletteCount=ref(16);const defaultPaletteColors=['#ffffff','#000000','#ff0000','#0000ff','#00ff00','#ffff00','#00ffff','#ff00ff','#808080','#c0c0c0','#800000','#008000','#000080','#808000','#008080','#800080'];const paletteColorCount=ref(16);const paletteColors=ref([...defaultPaletteColors]);const framePaletteFromSession=ref(false);const canvasBackgroundColor=ref('#ffffff');const availablePaletteColors=computed(()=>paletteColors.value.slice(0,paletteColorCount.value));const paletteText=computed(()=>availablePaletteColors.value.map(rgbHexTo565).join(', '));const frameFile=ref<File|null>(null);const imageCropCanvas=ref<HTMLCanvasElement|null>(null);let selectedImageBitmap:ImageBitmap|null=null;const imagePreviewReady=ref(false);const imageCropError=ref('');const imageCropZoom=ref(1);const imageCropX=ref(0);const imageCropY=ref(0);const imageCropSize=ref(0);const imageFitMode=ref<'contain'|'cover'>('contain');const imageCropDrag=ref<{clientX:number;clientY:number;x:number;y:number}|null>(null);const frameSessionOpen=ref(false);const frameCount=ref(0);const pixelBoard=ref<HTMLCanvasElement|null>(null);const pixelPixels=ref<Uint8Array>(new Uint8Array(128*128));const pixelGridMarks=computed(()=>{const size=frameSpec.value.width;const step=size<=32?4:size<=64?8:16;const marks:number[]=[];for(let mark=0;mark<size;mark+=step)marks.push(mark);marks.push(size);return marks;});const pixelGridPath=computed(()=>{const size=frameSpec.value.width;const commands:string[]=[];for(let line=1;line<size;line++)commands.push(`M${line} 0V${size}`,`M0 ${line}H${size}`);return commands.join(' ');});const drawingStrokes=ref<PixelChange[][]>([]);let pendingPixelChanges:PixelChange[]=[];const selectedPaletteIndex=ref(1);const brushSize=ref(1);const canvasSendMode=ref<'final'|'process'>('final');const playbackSeconds=ref(4);const pixelStrokeActive=ref(false);const lastPaintPoint=ref<{x:number;y:number}|null>(null);const canvasPlaybackActive=ref(false);const canvasPlaybackProgress=ref(0);const stopCanvasPlayback=ref(false);const recordingText=ref('');const recordingArtifact=ref('');const recordingTranscribing=ref(false);const recordingError=ref('');const recordingActive=ref(false);const recordingStatus=ref('');const recordingSending=ref(false);const audioSource=ref<'text'|'file'|'tone'>('text');const audioFile=ref<File|null>(null);const audioText=ref('你好，这是一条终端音频播放测试。');const audioLoading=ref(false);const audioToneLoading=ref('');const audioStatus=ref('');const audioStatusType=ref<'success'|'error'|'info'|'warning'>('info');let deviceLoadGeneration=0;let requestLoadGeneration=0;let historyLoadGeneration=0;let historyDetailGeneration=0;let viewStateLoadGeneration=0;let deviceContextGeneration=0;let frameOperationGeneration=0;let deviceMutationGeneration=0;
const selectedRequest=computed<DebugActionProjection|undefined>(()=>available.value?.requests?.find((item)=>item.name===requestName.value));
const availableSectionTemplates=computed(()=>Object.values(sectionCatalog.value));
const currentSectionTemplate=computed(()=>sectionCatalog.value[sectionType.value]);
const arrayField=computed(()=>isChartSection(sectionType.value)?null:currentSectionTemplate.value?.displayFields.find(field=>field.type==='array')??null);
const currentSectionFields=computed(()=>currentSectionTemplate.value?.displayFields.filter(field=>field.type!=='array')??[]);
const actionValues=reactive<Record<string,Record<string,unknown>>>({});
const actionErrors=reactive<Record<string,Record<string,string>>>({});
const sendingAction=ref('');
const actionSubmitError=ref('');
const sectionSending=ref(false);
const frameSending=computed(()=>sending.value && !sendingAction.value && !sectionSending.value);
const lightModes=[{value:'solid',label:'常亮'},{value:'blink',label:'闪烁'},{value:'breathe',label:'呼吸'},{value:'rainbow',label:'彩虹'},{value:'chase',label:'追逐'}];
const knownNoParamActions=new Set(['system.reboot','system.provisioning.start','business.reset','display.image.end','display.canvas.close','audio.playback.stop','feedback.rgb.off']);
const requestLabels:Record<string,string>={'system.volume.set':'设置音量','system.brightness.set':'设置屏幕亮度','feedback.rgb.set':'设置 RGB 指示灯','feedback.rgb.off':'关闭 RGB 指示灯','system.reboot':'重启设备','system.provisioning.start':'启动设备配网','business.reset':'清除业务配置','audio.playback.start':'开始音频播放','audio.playback.stop':'停止音频播放','display.image.end':'结束图片显示','display.canvas.close':'关闭 Canvas','view.section':'更新屏幕内容','audio.capture.start':'开始录音','audio.capture.stop':'停止录音','view.image':'显示图片','view.canvas':'播放画板'};
const recordingSupported=computed(()=>supportsCapability((available.value?.requests??[]).map(action=>action.name),'audio.record'));
const quickActions=computed(()=>(available.value?.requests??[]).map(action=>{
  const documented=action.name==='feedback.rgb.set'
    ? [...['r','g','b','brightness'].map(name=>({name,type:'integer',required:true,min:0,max:name==='brightness'?100:255})), {name:'mode',type:'enum',required:false,values:['solid','blink','breathe','rainbow','chase']}]
    : action.parameters?.length?action.parameters:action.params;
  const safeParams=documented.filter(param=>!['object','array'].includes(param.type));
  const unsupportedParams=documented.some(param=>['object','array'].includes(param.type));
  const parametersUnavailable=unsupportedParams||(!documented.length&&!knownNoParamActions.has(action.name));
  if(!actionValues[action.name])actionValues[action.name]=action.name==='feedback.rgb.set'?{r:0,g:96,b:255,brightness:35,mode:'solid'}:{};
  if(!actionErrors[action.name])actionErrors[action.name]={};
  safeParams.forEach(param=>{
    if(actionValues[action.name][param.name]!==undefined)return;
    if(param.values?.length)actionValues[action.name][param.name]=param.values[0];
    else if(param.required&&isNumericParameter(param)&&param.min!=null&&param.min===param.max)actionValues[action.name][param.name]=param.min;
    else if(param.required&&isNumericParameter(param)&&param.min!=null)actionValues[action.name][param.name]=param.min;
  });
  return {...action,formParams:safeParams,parametersUnavailable};
}).filter(action=>isVisibleDirectCommand(action.name,'debug')));
const parameterActions=computed(()=>quickActions.value.filter(action=>action.formParams.length || action.parametersUnavailable));
const deviceParameterActions=computed(()=>parameterActions.value.filter(action=>action.name!=='feedback.rgb.set'));
const lightActions=computed(()=>quickActions.value.filter(action=>action.name==='feedback.rgb.set'));
const rgbOffAction=computed(()=>quickActions.value.find(action=>action.name==='feedback.rgb.off' && !action.parametersUnavailable));
const shortcutActions=computed(()=>quickActions.value.filter(action=>!action.formParams.length && !action.parametersUnavailable && action.name!=='feedback.rgb.off'));
function actionParameterLabel(name:string,param:DebugActionProjection['params'][number]){const label=param.name==='value'?(name==='system.volume.set'?'音量':name==='system.brightness.set'?'屏幕亮度':param.name):({brightness:'亮度',mode:'模式',duration:'时长'}[param.name]||param.name);return `${label}${param.unit?` · ${param.unit}`:''}`;}
function isNumericParameter(param:DebugActionProjection['params'][number]){return ['int','integer','float','number'].includes(param.type);}
function rgbColor(name:string){const value=actionValues[name]||{};return '#'+['r','g','b'].map(channel=>Number(value[channel]??0).toString(16).padStart(2,'0')).join('');}
function setRgbColor(name:string,color:string|null){if(!color)return;['r','g','b'].forEach((channel,index)=>{actionValues[name][channel]=parseInt(color.slice(1+index*2,3+index*2),16);});}
function actionLabel(name:string){return requestLabels[name]||name;}
const parameterCount=(action:any)=>action.parametersUnavailable?2:action.formParams.length;
const deviceActionCards=computed(()=>deviceParameterActions.value.map(action=>({...action,wide:parameterCount(action)>1})));
const parsedPalette=computed(()=>availablePaletteColors.value.map(rgbHexTo565));
function rgbHexTo565(hex:string){const value=hex.replace('#','');const red=parseInt(value.slice(0,2),16);const green=parseInt(value.slice(2,4),16);const blue=parseInt(value.slice(4,6),16);return ((red>>3)<<11)|((green>>2)<<5)|(blue>>3);}
function updatePaletteColor(index:number,value:string|null){if(!value)return;const paletteIndex=Math.max(1,index);paletteColors.value[paletteIndex]=value;void nextTick(drawPixelBoard);}
function setCanvasBackgroundColor(color:string|null){if(!color)return;canvasBackgroundColor.value=color;paletteColors.value[0]=color;void nextTick(drawPixelBoard);}
function setCanvasBrushColor(color:string){const existingIndex=paletteColors.value.findIndex((value,index)=>index>0&&index<paletteColorCount.value&&value.toLowerCase()===color.toLowerCase());const index=existingIndex>0?existingIndex:Math.max(1,Math.min(selectedPaletteIndex.value,paletteColorCount.value-1));paletteColors.value[index]=color;selectedPaletteIndex.value=index;void nextTick(drawPixelBoard);}
const expectedFrameBytes=computed(()=>{const bits=paletteBits(parsedPalette.value.length);return bits?frameSpec.value.width*frameSpec.value.height*bits/8:null;});
const canvasFrameBytes=computed(()=>expectedFrameBytes.value);
const canCompleteFrame=computed(()=>frameSessionOpen.value&&frameCount.value>0);
const imagePalette=computed(()=>defaultPaletteColors.slice(0,imagePaletteCount.value).map(rgbHexTo565));
const imageSpecError=computed(()=>validateFrameSpec('image').error || '');
const frameSpecError=computed(()=>{
  const validation=validateFrameSpec('canvas');
  return 'error' in validation ? validation.error : '';
});
function dataOf(response:any){return response?.data;}
function isRecord(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function isDebugParameter(value:unknown):value is DebugActionProjection['params'][number]{
  if(!isRecord(value)||typeof value.name!=='string'||!value.name||typeof value.type!=='string'||!value.type
    ||!(value.required==null||typeof value.required==='boolean')
    ||!(value.min==null||(typeof value.min==='number'&&Number.isFinite(value.min)))
    ||!(value.max==null||(typeof value.max==='number'&&Number.isFinite(value.max)))
    ||(value.min!=null&&value.max!=null&&Number(value.min)>Number(value.max))
    ||!(value.unit==null||typeof value.unit==='string')
    ||!(value.values==null||(Array.isArray(value.values)&&value.values.every(item=>item===null||['string','number','boolean'].includes(typeof item)))))return false;
  if(Array.isArray(value.values)&&new Set(value.values.map(item=>`${typeof item}:${String(item)}`)).size!==value.values.length)return false;
  if(Array.isArray(value.values)&&['int','integer','float','number'].includes(value.type)
    &&!value.values.every(item=>typeof item==='number'&&Number.isFinite(item)))return false;
  if(Array.isArray(value.values)&&value.type==='boolean'&&!value.values.every(item=>typeof item==='boolean'))return false;
  if(Array.isArray(value.values)&&['text','string','url','color'].includes(value.type)
    &&!value.values.every(item=>typeof item==='string'))return false;
  return true;
}
function parseAvailableRequests(value:unknown,expectedDeviceId:string):DebugAvailableRequests{
  if(!isRecord(value)||value.deviceId!==expectedDeviceId||typeof value.online!=='boolean'||!Array.isArray(value.requests))throw new Error('设备请求目录响应结构无效');
  const requestNames=new Set<string>();
  const validRequests=value.requests.every((item)=>{
    if(!isRecord(item)||typeof item.name!=='string'||!item.name||requestNames.has(item.name)
      ||!Array.isArray(item.usableIn)||!item.usableIn.every((entry)=>typeof entry==='string')
      ||new Set(item.usableIn).size!==item.usableIn.length||typeof item.usableInBinding!=='boolean'
      ||item.usableInRequest!==true||!(item.description==null||typeof item.description==='string')
      ||!Array.isArray(item.params)||!item.params.every(isDebugParameter)
      ||new Set(item.params.map((param:any)=>param.name)).size!==item.params.length
      ||!(item.parameters==null||(Array.isArray(item.parameters)&&item.parameters.every(isDebugParameter)))
      ||!(item.parametersSource==null||typeof item.parametersSource==='string'))return false;
    requestNames.add(item.name);
    return true;
  });
  if(!validRequests)throw new Error('设备请求目录条目结构无效');
  return value as unknown as DebugAvailableRequests;
}
function parseJournalEntry(value:unknown):value is DebugJournalEntry{return isRecord(value)&&typeof value.requestId==='string'&&typeof value.name==='string'&&isRecord(value.params)&&typeof value.ok==='boolean'&&(value.error==null||typeof value.error==='string')&&typeof value.declared==='boolean'&&(value.detail==null||isRecord(value.detail))&&typeof value.at==='string';}
function parseRequestResult(value:unknown):DebugRequestResult{
  if(!isRecord(value)||typeof value.requestId!=='string'||typeof value.name!=='string'||typeof value.ok!=='boolean'||!(value.error==null||typeof value.error==='string')||typeof value.declared!=='boolean'||typeof value.reachable!=='boolean'||!isRecord(value.extra))throw new Error('设备请求响应结构无效');
  return value as unknown as DebugRequestResult;
}
function parseRequestHistory(value:unknown,expectedDeviceId:string):DebugJournalEntry[]{
  if(!isRecord(value)||value.deviceId!==expectedDeviceId||!Array.isArray(value.history)||!value.history.every(parseJournalEntry))throw new Error('请求历史响应结构无效');
  return value.history;
}
async function loadDevices(){
  const generation=++deviceLoadGeneration;loadingDevices.value=true;deviceListError.value='';
  try{
    const result=dataOf(await getDeviceList({page:0,size:200,registrationStatus:'CLAIMED'}));
    if(generation!==deviceLoadGeneration)return;
    if(!isRecord(result)||!Array.isArray(result.items))throw new Error('终端列表响应结构无效');
    devices.value=result.items.filter((item:any)=>item&&typeof item.deviceId==='string').map((item:any)=>({deviceId:item.deviceId,name:item.name,status:item.status}));
    const queryId=typeof route.query.deviceId==='string'?route.query.deviceId:'';
    if(queryId&&devices.value.some((item:any)=>item.deviceId===queryId))deviceId.value=queryId;
    else if(!deviceId.value&&devices.value.length)deviceId.value=devices.value[0].deviceId;
    if(deviceId.value)void onDeviceChange();
  }catch(cause:any){if(generation===deviceLoadGeneration)deviceListError.value=cause?.message||'终端列表读取失败';}
  finally{if(generation===deviceLoadGeneration)loadingDevices.value=false;}
}
async function loadRequests(){
  const requested=deviceId.value;if(!requested)return;const generation=++requestLoadGeneration;
  requestDirectoryLoading.value=true;requestDirectoryError.value='';
  try{
    const result=parseAvailableRequests(dataOf(await getDebugAvailableRequests(requested)),requested);
    if(deviceId.value!==requested||generation!==requestLoadGeneration)return;
    available.value=result;
    if(!requestName.value||!result.requests.some(item=>item.name===requestName.value))requestName.value=result.requests[0]?.name||'';
    resetParams();
  }catch(cause:any){if(deviceId.value===requested&&generation===requestLoadGeneration){requestDirectoryError.value=cause?.message||'设备能力读取失败';available.value=null;}}
  finally{if(deviceId.value===requested&&generation===requestLoadGeneration)requestDirectoryLoading.value=false;}
}
async function loadHistory(){
  const requested=deviceId.value;if(!requested)return;const generation=++historyLoadGeneration;
  historyLoading.value=true;historyError.value='';
  try{
    const rows=parseRequestHistory(dataOf(await getDebugRequestHistory(requested,30)),requested);
    if(deviceId.value!==requested||generation!==historyLoadGeneration)return;
    history.value=rows;
  }catch(cause:any){if(deviceId.value===requested&&generation===historyLoadGeneration)historyError.value=cause?.message||'请求历史读取失败';}
  finally{if(deviceId.value===requested&&generation===historyLoadGeneration)historyLoading.value=false;}
}
async function loadSectionCatalog(){
  try{sectionCatalog.value=parseSectionCatalog(dataOf(await getSectionCatalog()));sectionCatalogError.value='';if(!currentSectionTemplate.value)resetSectionFields();}
  catch(cause:any){sectionCatalogError.value=cause?.message||'界面模板目录读取失败';}
}
function resetSectionFields(){
  sectionFieldErrors.value={};Object.keys(sectionValues).forEach(key=>delete sectionValues[key]);sectionValues.title='';sectionRows.value=[];
  if(isChartSection(sectionType.value)){Object.assign(sectionValues,defaultChartFields(sectionType.value));return;}
  const template=currentSectionTemplate.value;if(!template)return;
  for(const field of template.displayFields){
    if(field.type==='array'){
      const initial=Array.isArray(field.defaultValue)?field.defaultValue:[];
      sectionRows.value=initial.map((row:any)=>isRecord(row)?{...row}:{});
    }else if(field.defaultValue!==undefined)sectionValues[field.name]=field.defaultValue;
    else if(field.type==='boolean')sectionValues[field.name]=false;
    else if(['int','integer','number','float'].includes(field.type))sectionValues[field.name]=field.min??0;
    else sectionValues[field.name]='';
  }
}
function addSectionRow(){
  const field=arrayField.value;if(!field)return;
  const row:Record<string,unknown>={};
  for(const child of field.children||[])row[child.name]=child.defaultValue??'';
  sectionRows.value.push(row);
}
function removeSectionRow(index:number){sectionRows.value.splice(index,1);}
function updateChartFields(fields:Record<string,any>){Object.keys(sectionValues).forEach(key=>delete sectionValues[key]);Object.assign(sectionValues,fields);}
function buildSection():Record<string,unknown>{
  if(isChartSection(sectionType.value)){const error=chartSectionError(sectionType.value,sectionValues);if(error)throw new Error(error);return {type:sectionType.value,...sectionValues};}
  const template=currentSectionTemplate.value;if(!template)throw new Error('当前模板尚未加载');
  const section:Record<string,unknown>={type:sectionType.value};
  for(const field of template.displayFields){
    if(field.type==='array'){
      const rows=sectionRows.value.map((row,index)=>{
        const result:Record<string,unknown>={};
        for(const child of field.children||[]){
          const value=row[child.name];
          if(child.required&&(value===undefined||value===null||value===''))throw new Error(`${field.label||field.name}第 ${index+1} 项：${child.label||child.name}必填`);
          if(value!==undefined&&value!==null&&value!=='')result[child.name]=value;
        }
        return result;
      });
      if(field.required&&!rows.length)throw new Error(`${field.label||field.name}至少需要一项`);
      if(rows.length)section[field.name]=rows;
      continue;
    }
    const value=sectionValues[field.name];
    if(field.required&&(value===undefined||value===null||value===''))throw new Error(`${field.label||field.name}为必填项`);
    if(value!==undefined&&value!==null&&value!=='')section[field.name]=value;
  }
  return section;
}
async function loadDeviceContext(){
  const requested=deviceId.value;if(!requested)return;const generation=++deviceContextGeneration;
  supportedSectionTypes.value=null;sectionCapabilityReady.value=false;sectionCapabilityError.value='';
  frameCapabilities.value=null;frameCapabilityError.value='正在读取设备图片 / Canvas 能力';
  try{
    const schema=dataOf(await getDeviceCapabilitySchema(requested));
    if(deviceId.value!==requested||generation!==deviceContextGeneration)return;
    const ui=isRecord(schema)&&isRecord(schema.surface)&&isRecord(schema.surface.ui)?schema.surface.ui:null;
    supportedSectionTypes.value=Array.isArray(ui?.sectionTypes)?ui!.sectionTypes.filter((item):item is string=>typeof item==='string'):[];
    sectionCapabilityReady.value=true;sectionCapabilityError.value='';
    const surface=isRecord(schema)&&isRecord(schema.surface)?schema.surface:null;
    const canvas=surface&&isRecord(surface.canvas)?surface.canvas:null;
    const declaredResolutions=canvas?.resolutions;
    const resolutions=Array.isArray(declaredResolutions)?frameSizes.filter(size=>declaredResolutions.includes(`${size}x${size}`)):null;
    const colorBits=Array.isArray(canvas?.colorBits)?canvas!.colorBits.map(Number).filter((item:number)=>[1,2,4].includes(item)):null;
    const image=surface&&isRecord(surface.image)?surface.image:null;
    frameCapabilities.value={viewModes:Array.isArray(ui?.viewModes)?ui!.viewModes.filter((item):item is string=>typeof item==='string'):null,resolutions,maxBytes:Number.isInteger(image?.maxBytes)?Number(image!.maxBytes):null,maxPaletteColors:Number.isInteger(image?.maxPaletteColors)?Number(image!.maxPaletteColors):null,colorBits,maxFps:Number.isInteger(canvas?.maxFps)?Number(canvas!.maxFps):null};
    frameCapabilityError.value='';
  }catch(cause:any){
    if(deviceId.value===requested&&generation===deviceContextGeneration){supportedSectionTypes.value=null;sectionCapabilityReady.value=false;sectionCapabilityError.value=cause?.message||'终端能力读取失败';frameCapabilityError.value=sectionCapabilityError.value;}
  }
  if(deviceId.value===requested&&generation===deviceContextGeneration)void loadViewState();
}
function clearInvalidDeviceQuery(){const query={...route.query};delete query.deviceId;void router.replace({query});}
async function onDeviceChange(){
  recordingActive.value=false;recordingStatus.value='';recordingError.value='';recordingText.value='';recordingArtifact.value='';recordingTranscribing.value=false;deviceMutationGeneration++;requestLoadGeneration++;historyLoadGeneration++;historyDetailGeneration++;viewStateLoadGeneration++;deviceContextGeneration++;
frameOperationGeneration++;sending.value=false;sendingAction.value='';sectionSending.value=false;actionSubmitError.value='';frameSessionOpen.value=false;framePaletteFromSession.value=false;frameCount.value=0;imageSpec.value={width:128,height:128};imagePaletteCount.value=16;frameFile.value=null;selectedImageBitmap?.close();selectedImageBitmap=null;imagePreviewReady.value=false;audioStatus.value='';audioLoading.value=false;audioToneLoading.value='';requestDirectoryLoading.value=false;requestDirectoryError.value='';history.value=[];historyError.value='';historyDetailError.value='';historyLoading.value=false;selectedHistory.value=null;viewStateError.value='';viewStateLoading.value=false;error.value='';requestName.value='';requestParams.value={};available.value=null;
  const requested=deviceId.value;if(!requested)return;
  // Start capability loading after invalidating the previous device context.
  void Promise.all([loadDeviceContext(),loadRequests(),loadHistory()]);
}
function parseViewState(value:unknown,expectedDeviceId:string):DebugViewState{
  if(!isRecord(value)||value.deviceId!==expectedDeviceId||typeof value.online!=='boolean'||!(value.mode==null||['none','section','image','canvas'].includes(String(value.mode)))||![value.imageBytesReceived,value.canvasFramesReceived,value.canvasFramesRejected].every((count)=>Number.isSafeInteger(count)&&Number(count)>=0))throw new Error('主视图状态响应结构无效');
  const validDimensions=(spec:Record<string,unknown>)=>Number.isInteger(spec.width)&&Number.isInteger(spec.height)&&spec.width===spec.height&&[16,32,64,128].includes(Number(spec.width))&&[2,4,16].includes(Number(spec.paletteSize));
  const imageSpec=value.imageSpec;
  if(imageSpec!=null&&(!isRecord(imageSpec)||!validDimensions(imageSpec)||!Number.isSafeInteger(imageSpec.expectedBytes)||Number(imageSpec.expectedBytes)<=0||Number(imageSpec.expectedBytes)!==Math.ceil(Number(imageSpec.width)*Number(imageSpec.height)*(Number(imageSpec.paletteSize)===2?1:Number(imageSpec.paletteSize)===4?2:4)/8)))throw new Error('图片会话规格结构无效');
  const canvasSpec=value.canvasSpec;
  if(canvasSpec!=null&&(!isRecord(canvasSpec)||!validDimensions(canvasSpec)||!Number.isSafeInteger(canvasSpec.maxFps)||Number(canvasSpec.maxFps)<0))throw new Error('Canvas 会话规格结构无效');
  if(value.mode==='image'&&(!imageSpec||canvasSpec!=null||Number(value.imageBytesReceived)>Number((imageSpec as Record<string,unknown>).expectedBytes)))throw new Error('图片视图会话规格或接收计数无效');
  if(value.mode==='canvas'&&(!canvasSpec||imageSpec!=null))throw new Error('Canvas 视图会话规格无效');
  if(value.mode!=='image'&&imageSpec!=null||value.mode!=='canvas'&&canvasSpec!=null)throw new Error('非活动视图携带了活动会话规格');
  return value as unknown as DebugViewState;
}
async function loadViewState(){
  const requested=deviceId.value;
  if(!requested)return;
  const generation=++viewStateLoadGeneration;
  viewStateLoading.value=true;
  viewStateError.value='';
  try{
    const value=parseViewState(dataOf(await getDebugViewState(requested)),requested);
    if(deviceId.value!==requested||generation!==viewStateLoadGeneration)return;

    const activeMode=value.mode==='image'||value.mode==='canvas';
    if(!activeMode){frameSessionOpen.value=false;framePaletteFromSession.value=false;frameCount.value=0;frameFile.value=null;return;}
    frameSessionOpen.value=true;
    frameMode.value=value.mode as 'image'|'canvas';
    const spec=value.mode==='image'?value.imageSpec:value.canvasSpec;
    if(spec){
      if(value.mode==='canvas'){
        frameSpec.value={width:Number(spec.width)||128,height:Number(spec.height)||128,maxFps:Number(spec.maxFps)||10};
        const paletteCount=Number(spec.paletteSize);
        if([2,4,16].includes(paletteCount)){paletteColorCount.value=paletteCount;framePaletteFromSession.value=true;}
        resetPixelBoard();
      }else{imageSpec.value={width:Number(spec.width)||128,height:Number(spec.height)||128};imagePaletteCount.value=Number(spec.paletteSize)||16;}
    }
    frameCount.value=value.mode==='image'?(value.imageBytesReceived>0?1:0):value.canvasFramesReceived;
  }catch(cause:any){
    if(deviceId.value===requested&&generation===viewStateLoadGeneration){viewStateError.value=cause.message||'视图状态读取失败';}
  }finally{
    if(deviceId.value===requested&&generation===viewStateLoadGeneration)viewStateLoading.value=false;
  }
}
function resetParams(){requestParams.value={};requestJsonDrafts.value={};requestParamErrors.value={};(selectedRequest.value?.params||[]).forEach((param:any)=>{if(param.required&&param.values?.length)requestParams.value[param.name]=param.values[0];});}
async function submitAction(action:any){
  if(!deviceId.value||!available.value?.online||action.parametersUnavailable||sending.value)return;
  if(action.name==='business.reset'){try{await ElMessageBox.confirm('将清除终端当前业务配置与场景，是否继续？','清理业务配置',{type:'warning',confirmButtonText:'确认清理',cancelButtonText:'取消'});}catch{return;}}
  if(action.name==='system.reboot'){try{await ElMessageBox.confirm('终端将立即重启，是否继续？','重启终端',{type:'warning',confirmButtonText:'重启',cancelButtonText:'取消'});}catch{return;}}
  const values=actionValues[action.name]||{};
  const errors:Record<string,string>={};
  action.formParams.forEach((param:any)=>{
    const value=values[param.name];
    if(param.required&&(value===undefined||value===null||value==='')){errors[param.name]='此参数为必填项';return;}
    if(value===undefined||value===null||value==='')return;
    if(param.values?.length&&!param.values.some((option:unknown)=>Object.is(option,value))){errors[param.name]='所选值不在允许范围内';return;}
    if(isNumericParameter(param)&&(typeof value!=='number'||!Number.isFinite(value)||(['int','integer'].includes(param.type)&&!Number.isInteger(value))||(param.min!=null&&value<param.min)||(param.max!=null&&value>param.max)))errors[param.name]='请输入契约范围内的数值';
  });
  actionErrors[action.name]=errors;
  if(Object.keys(errors).length){ElMessage.error('请检查卡片中的参数');return;}
  sendingAction.value=action.name;actionSubmitError.value='';historyDetailGeneration++;historyDetailLoading.value=false;historyDetailError.value='';sending.value=true;
  const requested=deviceId.value;const operation=++deviceMutationGeneration;
  try{
    const params=Object.fromEntries(action.formParams.filter((param:any)=>values[param.name]!==undefined&&values[param.name]!==null&&values[param.name]!=='').map((param:any)=>[param.name,values[param.name]]));
    const result=parseRequestResult(dataOf(await sendDebugRequest(requested,{name:action.name,params})));
    if(deviceId.value!==requested||operation!==deviceMutationGeneration)return;
    selectedHistory.value=result;ElMessage[result.ok?'success':'error'](result.ok?'操作已完成':result.error||'设备拒绝操作');await loadHistory();
  }catch(cause:any){if(deviceId.value===requested&&operation===deviceMutationGeneration){actionSubmitError.value=cause.message||'操作失败';ElMessage.error(actionSubmitError.value);}}
  finally{if(deviceId.value===requested&&operation===deviceMutationGeneration){sendingAction.value='';sending.value=false;}}
}
function setRequestJson(param:any,value:string){requestJsonDrafts.value[param.name]=value;if(!value.trim()){delete requestParams.value[param.name];delete requestParamErrors.value[param.name];return;}try{const parsed=JSON.parse(value);const matchesShape=param.type==='array'?Array.isArray(parsed):parsed!==null&&typeof parsed==='object'&&!Array.isArray(parsed);if(!matchesShape)throw new Error(param.type==='array'?'参数必须是 JSON 数组':'参数必须是 JSON 对象');requestParams.value[param.name]=parsed;delete requestParamErrors.value[param.name];}catch(cause:any){requestParamErrors.value[param.name]=cause instanceof SyntaxError?'JSON 格式错误':cause.message;}}
async function runRecordingCommand(name:string){
  const requested=deviceId.value;if(!requested)return false;recordingSending.value=true;
  try{const result=parseRequestResult(dataOf(await sendDebugRequest(requested,{name,params:{}})));if(requested!==deviceId.value)return false;selectedHistory.value=result;await loadHistory();if(!result.ok)throw new Error(result.error||'设备拒绝录音命令');return true;}
  catch(cause:any){if(requested===deviceId.value)recordingError.value=cause.message||'录音操作失败';return false;}
  finally{if(requested===deviceId.value)recordingSending.value=false;}
}
async function startRecording(){recordingText.value='';recordingArtifact.value='';recordingError.value='';if(await runRecordingCommand('audio.capture.start')){recordingActive.value=true;recordingStatus.value='录音中';}}
async function stopRecording(){
  recordingError.value='';
  const requested=deviceId.value;
  if(!await runRecordingCommand('audio.capture.stop'))return;
  recordingActive.value=false;recordingStatus.value='录音已停止';recordingTranscribing.value=true;
  try{
    const result=dataOf(await getDebugRecordingResult(requested));
    if(deviceId.value!==requested)return;
    recordingText.value=result.text||'';recordingArtifact.value=result.artifactId||'';
    recordingError.value=result.error||result.transcriptionError||'';
  }catch(cause:any){if(deviceId.value===requested)recordingError.value=cause.message||'录音结果读取失败';}
  finally{if(deviceId.value===requested)recordingTranscribing.value=false;}
}
async function submitRequest(){
  if(!deviceId.value||!requestName.value)return;
  if(Object.keys(requestParamErrors.value).length){ElMessage.error('请先修正参数 JSON 格式');return;}
  const errors:Record<string,string>={};
  const params=selectedRequest.value?.params||[];
  params.forEach((param:any)=>{
    const value=requestParams.value[param.name];
    const missing=value===undefined||value===null||value==='';
    if(param.required&&missing){errors[param.name]='此参数为必填项';return;}
    if(missing)return;
    if(param.values?.length&&!param.values.some((option:unknown)=>Object.is(option,value))){errors[param.name]='所选值已不在设备当前声明的选项中';return;}
    if(!['int','integer','float','number'].includes(param.type))return;
    if(typeof value!=='number'||!Number.isFinite(value)){errors[param.name]='请输入有效数字';return;}
    if(['int','integer'].includes(param.type)&&!Number.isInteger(value)){errors[param.name]='此参数必须是整数';return;}
    if(param.min!=null&&value<param.min){errors[param.name]=`不能小于 ${param.min}`;return;}
    if(param.max!=null&&value>param.max){errors[param.name]=`不能大于 ${param.max}`;}
  });
  requestParamErrors.value=errors;
  if(Object.keys(errors).length){ElMessage.error('请修正请求参数后再发送');return;}
  const requested=deviceId.value;
  const operation=++deviceMutationGeneration;
  const allowedParameterNames=new Set(params.map((param:any)=>param.name));
  const paramsPayload=Object.fromEntries(Object.entries(requestParams.value).filter(([name,value])=>
    allowedParameterNames.has(name)&&value!==undefined&&value!==null&&value!==''));
  const payload={name:requestName.value,params:paramsPayload};
  sending.value=true;
  try{
    const result=parseRequestResult(dataOf(await sendDebugRequest(requested,payload)));
    if(deviceId.value!==requested||operation!==deviceMutationGeneration)return;
    selectedHistory.value=result;
    ElMessage[result.ok?'success':'error'](result.ok?'请求已完成':result.error||'请求失败');
    await loadHistory();
  }catch(cause:any){if(deviceId.value===requested&&operation===deviceMutationGeneration){ElMessage.error(cause.message||'请求失败');await loadHistory();}}
  finally{if(deviceId.value===requested&&operation===deviceMutationGeneration)sending.value=false;}
}
async function selectHistory(row:DebugJournalEntry){actionSubmitError.value='';const requested=deviceId.value;const requestId=row?.requestId;if(!requested||!requestId)return;const generation=++historyDetailGeneration;selectedHistory.value=row;historyDetailLoading.value=true;historyDetailError.value='';try{const detail=dataOf(await getDebugRequestDetail(requested,requestId));if(!parseJournalEntry(detail)||detail.requestId!==requestId)throw new Error('请求详情响应结构无效');if(deviceId.value===requested&&generation===historyDetailGeneration)selectedHistory.value=detail;}catch(cause:any){if(deviceId.value===requested&&generation===historyDetailGeneration)historyDetailError.value=cause.message||'请求详情读取失败';}finally{if(deviceId.value===requested&&generation===historyDetailGeneration)historyDetailLoading.value=false;}}
async function publishSection(){
  if(!deviceId.value || !available.value?.online || sending.value)return;
  let section:Record<string,unknown>;
  try{section=buildSection();}catch(cause:any){ElMessage.warning(cause.message||'请检查屏幕内容');return;}
  if(!supportedSectionTypes.value?.includes(sectionType.value)){ElMessage.warning(`当前终端未声明支持 ${sectionCatalog.value[sectionType.value]?.displayName||sectionType.value} 模板`);return;}
  const requested=deviceId.value;const operation=++deviceMutationGeneration;
  sending.value=true;sectionSending.value=true;actionSubmitError.value='';
  historyDetailGeneration++;historyDetailLoading.value=false;historyDetailError.value='';
  try{
    const result=parseRequestResult(dataOf(await publishDebugView(requested,{mode:'section',section})));
    if(deviceId.value!==requested||operation!==deviceMutationGeneration)return;
    selectedHistory.value=result;
    ElMessage[result.ok?'success':'error'](result.ok?'屏幕内容已下发':result.error||'终端拒绝显示');
    await loadHistory();
  }catch(cause:any){
    if(deviceId.value===requested&&operation===deviceMutationGeneration){actionSubmitError.value=cause.message||'下发失败';ElMessage.error(actionSubmitError.value);}
  }finally{
    if(deviceId.value===requested&&operation===deviceMutationGeneration){sending.value=false;sectionSending.value=false;}
  }
}
function selectAudioFile(event:Event){audioFile.value=(event.target as HTMLInputElement).files?.[0]||null;}
async function playAudioBlob(blob:Blob){
  const requested=deviceId.value;if(!requested||!available.value?.online||audioLoading.value)return;
  audioLoading.value=true;audioStatus.value='正在转换并下发音频…';audioStatusType.value='info';
  const context=new AudioContext();
  try{
    const decoded=await context.decodeAudioData(await blob.arrayBuffer());
    const frames=Math.ceil(decoded.duration*22050);const offline=new OfflineAudioContext(1,frames,22050);const source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
    const rendered=await offline.startRendering();const samples=rendered.getChannelData(0);const pcm=new ArrayBuffer(samples.length*2);const view=new DataView(pcm);
    for(let i=0;i<samples.length;i++){const sample=Math.max(-1,Math.min(1,samples[i]));view.setInt16(i*2,sample<0?Math.round(sample*32768):Math.round(sample*32767),true);}
    const result:any=await sendDebugAudio(requested,pcm);if(requested!==deviceId.value)return;if(!result?.ok)throw new Error(result?.error||'音频播放失败');
    audioStatus.value=`播放完成：发送 ${result.bytesSent} 字节 / ${result.framesSent} 帧`;audioStatusType.value='success';
  }catch(cause:any){if(requested===deviceId.value){audioStatus.value=cause.message||'音频播放失败';audioStatusType.value='error';}}
  finally{await context.close();audioLoading.value=false;}
}
async function playAudioFile(){if(audioFile.value)await playAudioBlob(audioFile.value);}

async function playTts(){
  const requested=deviceId.value;const text=audioText.value.trim();if(!requested||!available.value?.online||!text||audioLoading.value)return;
  audioLoading.value=true;audioStatus.value='正在调用本地 TTS 合成并下发…';audioStatusType.value='info';
  try{const result:any=dataOf(await sendDebugTts(requested,text));if(deviceId.value!==requested)return;if(!result?.ok)throw new Error(result?.error||'TTS 合成或播放失败');audioStatus.value=`TTS 播放完成：发送 ${result.bytesSent} 字节 / ${result.framesSent} 帧`;audioStatusType.value='success';ElMessage.success('TTS 音频已下发');}
  catch(cause:any){if(deviceId.value===requested){audioStatus.value=cause.message||'TTS 播放失败';audioStatusType.value='error';ElMessage.error(audioStatus.value);}}
  finally{audioLoading.value=false;}
}
async function playTestTone(tone:'short'|'double'|'low'){
  const requested=deviceId.value;if(!requested||!available.value?.online||audioLoading.value)return;
  audioLoading.value=true;audioToneLoading.value=tone;audioStatus.value='正在生成并下发提示音…';audioStatusType.value='info';
  try{const result:any=dataOf(await sendDebugTestTone(requested,tone));if(deviceId.value!==requested)return;if(!result?.ok)throw new Error(result?.error||'提示音播放失败');audioStatus.value=`提示音播放完成：发送 ${result.bytesSent} 字节 / ${result.framesSent} 帧`;audioStatusType.value='success';ElMessage.success('提示音已下发');}
  catch(cause:any){if(deviceId.value===requested){audioStatus.value=cause.message||'提示音播放失败';audioStatusType.value='error';ElMessage.error(audioStatus.value);}}
  finally{audioLoading.value=false;audioToneLoading.value='';}
}

function imageSourceRect(bitmap:ImageBitmap){
  const targetWidth=imageSpec.value.width;const targetHeight=imageSpec.value.height;
  const baseScale=imageFitMode.value==='cover'?Math.max(targetWidth/bitmap.width,targetHeight/bitmap.height):Math.min(targetWidth/bitmap.width,targetHeight/bitmap.height);
  const scale=baseScale*imageCropZoom.value;const width=targetWidth/scale;const height=targetHeight/scale;
  const maxX=Math.max(0,bitmap.width-width);const maxY=Math.max(0,bitmap.height-height);
  return {x:Math.max(0,Math.min(maxX,imageCropX.value)),y:Math.max(0,Math.min(maxY,imageCropY.value)),width:Math.min(bitmap.width,width),height:Math.min(bitmap.height,height)};
}
function resetImageCrop(){
  if(!selectedImageBitmap)return;
  const bitmap=selectedImageBitmap;const targetWidth=imageSpec.value.width;const targetHeight=imageSpec.value.height;
  const scale=imageFitMode.value==='cover'?Math.max(targetWidth/bitmap.width,targetHeight/bitmap.height):Math.min(targetWidth/bitmap.width,targetHeight/bitmap.height);
  const sourceWidth=Math.min(bitmap.width,targetWidth/scale);const sourceHeight=Math.min(bitmap.height,targetHeight/scale);
  imageCropZoom.value=1;imageCropX.value=(bitmap.width-sourceWidth)/2;imageCropY.value=(bitmap.height-sourceHeight)/2;imageCropSize.value=Math.min(sourceWidth,sourceHeight);
}
function selectFrame(event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0]||null;input.value='';frameFile.value=file;imageCropError.value='';imagePreviewReady.value=false;selectedImageBitmap?.close();selectedImageBitmap=null;imageCropZoom.value=1;imageCropX.value=0;imageCropY.value=0;imageCropSize.value=0;if(!file)return;createImageBitmap(file).then(bitmap=>{if(frameFile.value!==file){bitmap.close();return;}selectedImageBitmap=bitmap;imagePreviewReady.value=true;resetImageCrop();void nextTick(drawImageCropPreview);}).catch(cause=>{if(frameFile.value===file){imagePreviewReady.value=false;imageCropError.value=cause.message||'无法读取所选图片';}});}
watch(imageFitMode,()=>{if(selectedImageBitmap){resetImageCrop();drawImageCropPreview();}});
function drawImageCropPreview(){const canvas=imageCropCanvas.value;if(!canvas||!selectedImageBitmap)return;const context=canvas.getContext('2d');if(!context)return;context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';const source=imageSourceRect(selectedImageBitmap);context.drawImage(selectedImageBitmap,source.x,source.y,source.width,source.height,0,0,canvas.width,canvas.height);}
function startImageCropDrag(event:PointerEvent){if(!selectedImageBitmap||!imageCropCanvas.value)return;event.preventDefault();imageCropDrag.value={clientX:event.clientX,clientY:event.clientY,x:imageCropX.value,y:imageCropY.value};imageCropCanvas.value.setPointerCapture(event.pointerId);}
function moveImageCrop(event:PointerEvent){if(!imageCropDrag.value||!selectedImageBitmap||!imageCropCanvas.value)return;const bounds=imageCropCanvas.value.getBoundingClientRect();const source=imageSourceRect(selectedImageBitmap);const scale=source.width/bounds.width;const maxX=Math.max(0,selectedImageBitmap.width-source.width);const maxY=Math.max(0,selectedImageBitmap.height-source.height);imageCropX.value=Math.max(0,Math.min(maxX,imageCropDrag.value.x-(event.clientX-imageCropDrag.value.clientX)*scale));imageCropY.value=Math.max(0,Math.min(maxY,imageCropDrag.value.y-(event.clientY-imageCropDrag.value.clientY)*scale));drawImageCropPreview();}
function finishImageCropDrag(){imageCropDrag.value=null;}
function setImageCropZoom(value:number){if(!selectedImageBitmap)return;imageCropZoom.value=value;drawImageCropPreview();}

function paletteBits(count:number){return count===2?1:count===4?2:count===16?4:0;}
function validateFrameSpec(mode:'image'|'canvas'='canvas'){
  const palette=mode==='image'?imagePalette.value:parsedPalette.value;
  const bits=paletteBits(palette.length);
  const dimensions=mode==='image'?imageSpec.value:frameSpec.value;
  const size=dimensions.width;
  if(!frameSizes.includes(size)||size!==dimensions.height)return {error:'宽高必须相同，且为 16、32、64 或 128'};
  if(!bits)return {error:'调色板必须包含 2、4 或 16 个 RGB565 色值'};
  if(palette.some(value=>!Number.isInteger(value)||value<0||value>65535))return {error:'每个调色板值必须是 0～65535 的整数'};
  const byteLength=Math.ceil(size*size*bits/8);
  if(byteLength>8192)return {error:'帧超过平台 8192 字节上限'};
  const caps=frameCapabilities.value;
  if(caps){
    if(caps.viewModes&&!caps.viewModes.includes(mode))return {error:`设备未声明支持 ${mode==='image'?'图片':'Canvas'} 模式`};
    if(caps.resolutions&&!caps.resolutions.includes(size))return {error:`设备未声明支持 ${size}×${size} 分辨率`};
    if(caps.maxPaletteColors!==null&&palette.length>caps.maxPaletteColors)return {error:`设备最多支持 ${caps.maxPaletteColors} 种调色板颜色`};
    if(caps.maxBytes!==null&&byteLength>caps.maxBytes)return {error:`当前帧需要 ${byteLength} 字节，超过设备上限 ${caps.maxBytes} 字节`};
    if(mode==='canvas'&&caps.colorBits&&!caps.colorBits.includes(bits))return {error:`设备未声明支持 ${bits} 位 Canvas 色深`};
  }
  return {palette,bits,byteLength};
}
async function validateFrameIndices(file:Blob,bits:number,paletteCount:number,pixelCount:number){const bytes=new Uint8Array(await file.arrayBuffer());const mask=(1<<bits)-1;for(let pixel=0;pixel<pixelCount;pixel++){const bitOffset=pixel*bits;const byteIndex=bitOffset>>3;const shift=8-bits-(bitOffset&7);const index=(bytes[byteIndex]>>shift)&mask;if(index>=paletteCount)return `第 ${pixel+1} 个像素的索引 ${index} 超出调色板范围（0～${paletteCount-1}）`;}return '';}
function colorFrom565(value:number){return {r:((value>>11)&31)*255/31,g:((value>>5)&63)*255/63,b:(value&31)*255/31};}
async function packImageFile(file:File,bits:number){
  const bitmap=selectedImageBitmap&&frameFile.value===file?selectedImageBitmap:await createImageBitmap(file);const closeBitmap=bitmap!==selectedImageBitmap;const canvas=document.createElement('canvas');canvas.width=imageSpec.value.width;canvas.height=imageSpec.value.height;
  const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('浏览器无法读取图片像素');
  const palette=imagePalette.value.map(colorFrom565);const background=palette[0];
  context.fillStyle=`rgb(${Math.round(background.r)},${Math.round(background.g)},${Math.round(background.b)})`;
  context.fillRect(0,0,canvas.width,canvas.height);
  const source=imageSourceRect(bitmap);
  context.drawImage(bitmap,source.x,source.y,source.width,source.height,0,0,canvas.width,canvas.height);if(closeBitmap)bitmap.close();
  const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;const indexes=new Uint8Array(canvas.width*canvas.height);
  for(let pixel=0;pixel<indexes.length;pixel++){
    const offset=pixel*4;const alpha=pixels[offset+3]/255;const red=pixels[offset]*alpha+255*(1-alpha);const green=pixels[offset+1]*alpha+255*(1-alpha);const blue=pixels[offset+2]*alpha+255*(1-alpha);let best=0;let bestDistance=Infinity;
    palette.forEach((color,index)=>{const dr=red-color.r,dg=green-color.g,db=blue-color.b;const distance=dr*dr+dg*dg+db*db;if(distance<bestDistance){best=index;bestDistance=distance;}});indexes[pixel]=best;
  }
  const packed=new Uint8Array(Math.ceil(indexes.length*bits/8));
  indexes.forEach((index,pixel)=>{const bitOffset=pixel*bits;packed[bitOffset>>3]|=index<<(8-bits-(bitOffset&7));});
  return new Blob([packed],{type:'application/octet-stream'});
}
async function uploadAndDisplayImage(){
  if(sending.value || !available.value?.online || (frameSessionOpen.value && frameMode.value!=='image'))return;
  const spec=validateFrameSpec('image');
  frameMode.value='image';
  if(spec.error){ElMessage.error(spec.error);return;}
  const file=frameFile.value;
  if(!file)return;
  const requested=deviceId.value;
  const operation=++frameOperationGeneration;
  sending.value=true;
  try{
    const frame=file.type.startsWith('image/')?await packImageFile(file,spec.bits):file;
    if(deviceId.value!==requested||operation!==frameOperationGeneration||frameFile.value!==file)return;
    if(frame.size!==spec.byteLength)throw new Error(`图片转换后应为 ${spec.byteLength} 字节，当前为 ${frame.size} 字节`);
    const invalidIndex=await validateFrameIndices(frame,spec.bits,spec.palette.length,imageSpec.value.width*imageSpec.value.height);
    if(deviceId.value!==requested||operation!==frameOperationGeneration||frameFile.value!==file)return;
    if(invalidIndex)throw new Error(invalidIndex);
    if(!frameSessionOpen.value){
      const opened:any=dataOf(await publishDebugView(requested,{mode:'image',width:imageSpec.value.width,height:imageSpec.value.height,palette:spec.palette}));
      if(deviceId.value!==requested||operation!==frameOperationGeneration)return;
      if(!opened?.ok)throw new Error(opened?.error||'无法打开图片传输');
      frameSessionOpen.value=true;frameMode.value='image';framePaletteFromSession.value=false;frameCount.value=0;
    }
    const sent:any=await sendDebugViewFrame(requested,frame);
    if(deviceId.value!==requested||operation!==frameOperationGeneration)return;
    if(!sent?.ok)throw new Error(sent?.error||'图片帧上传失败');
    frameCount.value=1;
    const completed:any=dataOf(await completeDebugView(requested));
    if(deviceId.value!==requested||operation!==frameOperationGeneration)return;
    if(!completed?.ok)throw new Error(completed?.error||'图片已上传，但终端未确认完成显示');
    frameSessionOpen.value=false;frameFile.value=null;imagePreviewReady.value=false;selectedImageBitmap?.close();selectedImageBitmap=null;
    ElMessage.success('图片已上传并显示');
  }catch(cause:any){
    if(deviceId.value===requested&&operation===frameOperationGeneration){
      ElMessage.error(cause.message||'图片上传失败');
    }
  }finally{if(operation===frameOperationGeneration)sending.value=false;}
}
function drawPixelBoard(){
  const canvas=pixelBoard.value;if(!canvas)return;
  const size=frameSpec.value.width;canvas.width=size;canvas.height=size;
  const context=canvas.getContext('2d');if(!context)return;
  context.imageSmoothingEnabled=false;context.fillStyle=canvasBackgroundColor.value;context.fillRect(0,0,size,size);
  for(let index=0;index<pixelPixels.value.length;index++){
    const colorIndex=pixelPixels.value[index];if(colorIndex===0)continue;
    context.fillStyle=colorIndex===0?canvasBackgroundColor.value:(paletteColors.value[colorIndex]||paletteColors.value[0]||canvasBackgroundColor.value);
    context.fillRect(index%size,Math.floor(index/size),1,1);
  }

}
function setPixelResolution(size:number){frameSpec.value.width=size;frameSpec.value.height=size;resetPixelBoard();}
function resetPixelBoard(){
  pixelPixels.value=new Uint8Array(frameSpec.value.width*frameSpec.value.width);
  drawingStrokes.value=[];pendingPixelChanges=[];pixelStrokeActive.value=false;lastPaintPoint.value=null;selectedPaletteIndex.value=Math.min(1,paletteColorCount.value-1);
  void nextTick(drawPixelBoard);
}
function capturePixelFrame(){
  if(pendingPixelChanges.length)drawingStrokes.value.push(pendingPixelChanges);
  pendingPixelChanges=[];
}
function changePixel(index:number,color:number){
  const before=pixelPixels.value[index];if(before===color)return;
  pendingPixelChanges.push({index,before,after:color});pixelPixels.value[index]=color;
}
function pixelPosition(event:PointerEvent){
  const canvas=pixelBoard.value;if(!canvas)return null;
  const bounds=canvas.getBoundingClientRect();const size=frameSpec.value.width;
  if(event.clientX<bounds.left||event.clientX>=bounds.right||event.clientY<bounds.top||event.clientY>=bounds.bottom)return null;
  return {x:Math.max(0,Math.min(size-1,Math.floor((event.clientX-bounds.left)*size/bounds.width))),y:Math.max(0,Math.min(size-1,Math.floor((event.clientY-bounds.top)*size/bounds.height)))};
}
function paintPixel(point:{x:number;y:number}){
  const size=frameSpec.value.width;const radius=Math.floor(brushSize.value/2);
  for(let dy=-radius;dy<brushSize.value-radius;dy++)for(let dx=-radius;dx<brushSize.value-radius;dx++){
    const x=point.x+dx,y=point.y+dy;if(x>=0&&x<size&&y>=0&&y<size)changePixel(y*size+x,selectedPaletteIndex.value);
  }
}
function paintPixelLine(from:{x:number;y:number},to:{x:number;y:number}){
  const dx=to.x-from.x,dy=to.y-from.y,steps=Math.max(Math.abs(dx),Math.abs(dy),1);
  for(let step=0;step<=steps;step++)paintPixel({x:Math.round(from.x+dx*step/steps),y:Math.round(from.y+dy*step/steps)});
  drawPixelBoard();
}
function startPixelStroke(event:PointerEvent){
  if(sending.value)return;
  event.preventDefault();pixelStrokeActive.value=true;pixelBoard.value?.setPointerCapture(event.pointerId);
  const point=pixelPosition(event);if(point){paintPixel(point);lastPaintPoint.value=point;drawPixelBoard();}
}
function continuePixelStroke(event:PointerEvent){
  if(sending.value||!pixelStrokeActive.value)return;const point=pixelPosition(event);if(!point){lastPaintPoint.value=null;return;}
  paintPixelLine(lastPaintPoint.value||point,point);lastPaintPoint.value=point;
}
function finishPixelStroke(){
  if(!pixelStrokeActive.value)return;pixelStrokeActive.value=false;lastPaintPoint.value=null;capturePixelFrame();
}
function clearPixelBoard(){
  if(sending.value)return;finishPixelStroke();
  for(let index=0;index<pixelPixels.value.length;index++)changePixel(index,0);
  drawPixelBoard();capturePixelFrame();
}
function undoPixelStroke(){
  if(sending.value)return;finishPixelStroke();
  const stroke=drawingStrokes.value.pop();if(!stroke)return;
  for(let index=stroke.length-1;index>=0;index--)pixelPixels.value[stroke[index].index]=stroke[index].before;
  drawPixelBoard();
}
function packPixelIndexes(indexes:Uint8Array,bits:number){
  const packed=new Uint8Array(Math.ceil(indexes.length*bits/8));
  indexes.forEach((index,pixel)=>{const bitOffset=pixel*bits;packed[bitOffset>>3]|=index<<(8-bits-(bitOffset&7));});
  return new Blob([packed],{type:'application/octet-stream'});
}
function delay(ms:number){return new Promise(resolve=>window.setTimeout(resolve,ms));}
async function sendPixelCanvas(){
  if(sending.value || !available.value?.online || (frameSessionOpen.value && frameMode.value!=='canvas'))return;
  frameMode.value='canvas';
  const spec=validateFrameSpec();if(spec.error){ElMessage.error(spec.error);return;}
  finishPixelStroke();
  const requested=deviceId.value;const operation=++frameOperationGeneration;const finalPixels=pixelPixels.value.slice();
  const process=canvasSendMode.value==='process';const changes=drawingStrokes.value.flat();
  const width=frameSpec.value.width;const fps=frameSpec.value.maxFps;const seconds=playbackSeconds.value;
  const frameBudget=Math.max(1,Math.floor(fps*seconds));
  const updateCount=process?Math.min(changes.length,frameBudget):0;
  const frames=process?pixelPlaybackFrames(finalPixels.length,changes,frameBudget):[finalPixels];
  const totalFrames=process?updateCount+1:1;
  const interval=process&&updateCount>0?seconds*1000/updateCount:1000/fps;
  sending.value=true;canvasPlaybackActive.value=canvasSendMode.value==='process';canvasPlaybackProgress.value=0;stopCanvasPlayback.value=false;
  try{
    // Each push starts a fresh transfer. A local flag cannot prove that the device's old session survives.
    const opened:any=dataOf(await publishDebugView(requested,{mode:'canvas',width,height:width,palette:spec.palette,maxFps:fps}));
    if(deviceId.value!==requested||operation!==frameOperationGeneration)return;
    if(!opened?.ok)throw new Error(opened?.error||'无法打开 Canvas 会话');
    frameSessionOpen.value=true;frameMode.value='canvas';frameCount.value=0;
    let sent=0;let lastSendAt=0;
    for(const indexes of frames){
      if(stopCanvasPlayback.value)break;
      if(sent>0){const remaining=interval-(performance.now()-lastSendAt);if(remaining>0)await delay(remaining);}
      if(deviceId.value!==requested||operation!==frameOperationGeneration)return;
      if(stopCanvasPlayback.value)break;
      const frame=packPixelIndexes(indexes,spec.bits);lastSendAt=performance.now();const result:any=await sendDebugViewFrame(requested,frame);
      if(deviceId.value!==requested||operation!==frameOperationGeneration)return;
      if(!result?.ok)throw new Error(result?.error||'Canvas 帧提交失败');
      sent++;frameCount.value++;canvasPlaybackProgress.value=Math.round(sent/totalFrames*100);
    }
    if(sent>0)await delay(1000/fps+60);
    if(deviceId.value!==requested||operation!==frameOperationGeneration)return;
    ElMessage.success(stopCanvasPlayback.value?`绘制过程已停止，已发送 ${sent} 帧`:canvasSendMode.value==='final'?'最终画面已发送':`绘制过程已发送 ${sent} 帧`);
  }catch(cause:any){
    if(deviceId.value===requested&&operation===frameOperationGeneration){frameSessionOpen.value=false;ElMessage.error(cause.message||'Canvas 发送失败');}
  }finally{if(operation===frameOperationGeneration){sending.value=false;canvasPlaybackActive.value=false;stopCanvasPlayback.value=false;}}
}
function cancelCanvasPlayback(){stopCanvasPlayback.value=true;}
watch(()=>frameSpec.value.width,resetPixelBoard);
watch(paletteText,()=>void nextTick(drawPixelBoard));

let capabilityRefreshTimer:ReturnType<typeof setInterval>|null=null;
async function completeFrame(){if(!canCompleteFrame.value)return;const requested=deviceId.value;const operation=++frameOperationGeneration;sending.value=true;try{const result:any=dataOf(await completeDebugView(requested));if(deviceId.value!==requested||operation!==frameOperationGeneration)return;if(!result?.ok)throw new Error(result?.error||'设备拒绝完成视图');frameSessionOpen.value=false;ElMessage.success('视图传输完成');}catch(cause:any){if(deviceId.value===requested&&operation===frameOperationGeneration){ElMessage.error(cause.message||'完成视图失败');}}finally{if(operation===frameOperationGeneration)sending.value=false;}}
onMounted(()=>{capabilityRefreshTimer=setInterval(()=>{if(deviceId.value&&!sending.value&&!requestDirectoryLoading.value)void loadRequests();},3000);resetPixelBoard();void loadDevices();void loadSectionCatalog();});watch(deviceId,()=>{recordingText.value='';recordingArtifact.value='';recordingTranscribing.value=false;deviceMutationGeneration++;deviceContextGeneration++;supportedSectionTypes.value=null;sectionCapabilityReady.value=false;sectionCapabilityError.value='';frameCapabilities.value=null;frameCapabilityError.value='正在读取设备图片 / Canvas 能力';},{flush:'sync'});watch(()=>route.query.deviceId,queryDeviceId=>{const requested=typeof queryDeviceId==='string'?queryDeviceId:'';if(!requested)return;if(!devices.value.length&&loadingDevices.value)return;if(!devices.value.some((device:any)=>device.deviceId===requested)){deviceId.value='';void onDeviceChange();error.value=`URL 指定的终端 ${requested} 不在当前租户的已认领设备列表中`;clearInvalidDeviceQuery();return;}if(deviceId.value!==requested){deviceId.value=requested;void onDeviceChange();}});onBeforeUnmount(()=>{if(capabilityRefreshTimer)clearInterval(capabilityRefreshTimer);selectedImageBitmap?.close();selectedImageBitmap=null;imagePreviewReady.value=false;deviceMutationGeneration++;frameOperationGeneration++;deviceContextGeneration++;});
</script>
<style scoped lang="scss">
.debug-workbench { background: #f5f7fa; height: calc(100dvh - 84px); min-height: 0; box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden; padding: 16px; color: #1d2939; --el-color-primary: #1677ff; --el-color-primary-light-3: #5c9eff; --el-color-primary-light-5: #91bfff; --el-color-primary-light-7: #bad7ff; --el-color-primary-light-8: #d1e4ff; --el-color-primary-light-9: #e8f2ff; --el-color-primary-dark-2: #0958d9; }
.hero, .hero-heading, .device-picker, .card-header, .array-editor-title, .section-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.hero { margin-bottom: 12px; flex-shrink: 0; }
.hero-heading { justify-content: flex-start; }
.hero h1 { margin: 0; font-size: 22px; line-height: 1.5; font-weight: 600; }
.device-picker { width: 360px; max-width: 100%; }
.device-picker .el-select { flex: 1; min-width: 0; }
.debug-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; align-items: stretch; flex: 1; min-height: 0; }
.workspace { min-width: 0; min-height: 0; }
.workspace-columns { display: grid; height: 100%; min-height: 0; grid-template-columns: clamp(420px, 32vw, 560px) minmax(0, 1fr); gap: 16px; align-items: stretch; }
.compact-column { display: flex; flex-direction: column; gap: 12px; min-width: 0; min-height: 0; overflow-y: auto; container-type: inline-size; container-name: controls; }
.compact-column > * { flex-shrink: 0; }
.canvas-column { display: flex; flex-direction: column; gap: 16px; min-width: 0; min-height: 0; overflow-y: auto; }
.canvas-column > * { flex-shrink: 0; }
.device-controls, .light-controls, .audio-tools { min-width: 0; padding: 16px; border: 1px solid #e4e7ec; border-radius: 8px; background: #fff; }
.workspace-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
h2 { margin: 0; font-size: 15px; font-weight: 600; line-height: 22px; }
.action-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; align-items: start; }
.action-grid-compact { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; }
.shortcut-hint { margin: 12px 0 6px; color: #667085; font-size: 12px; line-height: 20px; }
.control-card { display: flex; align-items: center; gap: 8px; min-width: 0; max-width: 100%; box-sizing: border-box; padding: 0; }
.control-card-wide { grid-column: 1 / -1; }
.control-card .control-form { display: flex; flex: 1 1 auto; flex-wrap: nowrap; gap: 8px 12px; align-items: center; min-width: 0; }
.control-card .control-form :deep(.el-form-item) { display: flex; flex: 1 1 auto; flex-direction: row; align-items: center; gap: 6px; min-width: 0; margin-bottom: 0; }
.control-card .control-form :deep(.el-form-item__label) { flex: 0 0 96px; padding-bottom: 0; line-height: 20px; white-space: nowrap; text-align: left; }
.control-card .control-form :deep(.el-form-item__content) { flex: 1 1 auto; min-width: 0; }
.control-card .control-form :deep(.el-input-number) { width: 100%; }
.control-card .control-form :deep(.el-select) { min-width: 0; }
.control-card .control-action { flex: 0 0 auto; margin-top: 0; margin-left: 0; }
.control-card .control-action .el-button { padding-left: 10px; padding-right: 10px; width: 112px; }
.control-card-wide { flex-direction: column; align-items: stretch; }
.control-card-wide .control-form { flex-wrap: wrap; }
.control-card-wide .control-form :deep(.el-form-item) { flex: 0 0 auto; min-width: 168px; }
.control-card-wide .control-form :deep(.el-form-item__label) { flex: 0 0 auto; }
.control-card-plain .control-action, .control-card-wide .control-action { flex: 1 1 auto; }
.control-card-plain .control-action .el-button, .control-card-wide .control-action .el-button { width: 100%; }
.control-form :deep(.el-form-item) { margin-bottom: 10px; }
.control-form :deep(.el-form-item__label) { color: #475467; font-size: 12px; padding-bottom: 4px; }
.control-form .el-input-number { width: 132px; max-width: 100%; }
.control-form .el-select { width: 100%; max-width: 240px; }
.control-actions, .shortcut-actions, .recording-controls, .audio-source-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.control-actions :deep(.el-button + .el-button), .shortcut-actions :deep(.el-button + .el-button) { margin-left: 0; }
.control-action { display: flex; }
.control-action .el-button { flex: 1 1 auto; }
.rgb-form :deep(.el-form-item) { margin-bottom: 0; }
.rgb-row { display: flex; flex-wrap: nowrap; gap: 8px; align-items: flex-end; }
.rgb-mode { flex: 1 1 104px; min-width: 96px; }
.rgb-color { flex: 0 0 auto; }
.rgb-brightness { flex: 1 1 108px; min-width: 92px; }
.rgb-row :deep(.el-form-item__content) { display: flex; align-items: flex-end; min-height: 32px; }
.rgb-row .control-actions { flex: 0 0 auto; flex-wrap: nowrap; align-self: flex-end; align-items: flex-end; min-height: 32px; }
.rgb-row .control-actions .el-button { height: 32px; padding-left: 12px; padding-right: 12px; }
.rgb-row :deep(.el-select__wrapper),
.rgb-row :deep(.el-input-number),
.rgb-row :deep(.el-color-picker__trigger) { height: 32px; }
.rgb-form .el-input-number { width: 100%; }
.control-form :deep(.el-slider__runway.show-input) { margin-right: 10px; }
.control-form :deep(.el-slider__input) { width: 96px; flex-shrink: 0; }
.field-hint { display: block; width: 100%; margin-top: 4px; font-size: 12px; color: #667085; line-height: 1.5; }
.device-action-buttons { display: flex; flex-wrap: nowrap; gap: 6px; margin-top: 8px; overflow-x: auto; }
.device-action-buttons :deep(.el-button + .el-button) { margin-left: 0; }
.audio-source-row { gap: 12px; margin-bottom: 12px; }
.audio-source-row .el-radio-group { flex-wrap: nowrap; }
.audio-source-row .shortcut-actions { flex-wrap: nowrap; }
.audio-debug-card h2, .recording-card h2 { margin-bottom: 12px; }
.audio-debug-card :deep(.el-form-item) { margin-bottom: 0; }
.recording-card { margin-top: 16px; padding-top: 12px; border-top: 1px solid #eef0f3; }
.recording-controls { margin-bottom: 10px; font-size: 13px; color: #667085; }
.technical-details { margin-top: 12px; font-size: 12px; color: #475467; overflow-wrap: anywhere; }
.technical-details summary { cursor: pointer; margin-bottom: 8px; }
.debug-workbench > .el-alert { margin-bottom: 12px; flex-shrink: 0; }
.description, .muted { color: #667085; }

.workspace-columns .el-card { min-width: 0; border-color: #e4e7ec; border-radius: 8px; }
.workspace-columns :deep(.el-card__header) { padding: 12px 16px; font-size: 15px; font-weight: 600; }
.workspace-columns :deep(.el-card__body) { padding: 16px; }
.card-header { margin: 0; }
.section-editor-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0; align-items: start; }
.section-editor-layout > .el-form { display: grid; grid-template-columns: minmax(0, 1fr) minmax(160px, 0.62fr); gap: 0 16px; align-items: start; min-width: 0; max-width: none; }
.section-editor-layout > .el-form > * { grid-column: 1; min-width: 0; }
.section-editor-layout > .el-form > .section-preview { grid-column: 2; grid-row: 1 / span 3; }
.section-editor-layout :deep(.el-form-item) { margin-bottom: 12px; }
.section-editor-layout :deep(.el-form-item__label) { font-size: 12px; padding-bottom: 4px; }
.section-editor-layout .field-hint { margin: 0 0 10px; }
.section-array-editor { margin: 0 0 12px; }
.section-submit { min-width: 132px; justify-self: start; }
.section-preview { display: flex; flex-direction: column; justify-content: center; min-width: 0; padding: 12px; margin: 0 0 12px; border: 1px solid #eef0f3; border-radius: 8px; background: #fafbfc; }
.section-preview h4 { margin: 0 0 10px; color: #667085; font-size: 12px; font-weight: 400; }
.device-preview { width: 100%; box-sizing: border-box; min-height: 156px; max-height: 260px; overflow-y: auto; padding: 12px; border: 1px solid #d0d5dd; border-radius: 8px; background: #f8fafc; overflow-wrap: anywhere; }
.device-preview p { white-space: pre-wrap; font-size: 13px; }
.device-preview small { display: block; color: #667085; margin-top: 8px; }
.frame-debug-card :deep(.el-form-item) { margin-bottom: 12px; }
.frame-debug-card :deep(.el-form-item__label) { font-size: 12px; padding-bottom: 4px; }
.image-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 20px; align-items: start; }
.image-file-control { grid-column: 1 / -1; }
.image-file-control small { display: block; margin-top: 6px; color: #667085; font-size: 12px; line-height: 1.5; }
.image-form .frame-actions { grid-column: 1 / -1; margin-top: 4px; }
.frame-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.frame-actions :deep(.el-button + .el-button) { margin-left: 0; }
.palette-colors{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}.palette-color{display:flex;align-items:center;gap:5px}.palette-choice{display:flex;flex-direction:column;gap:10px}.color-swatch-list{align-items:center}.color-swatch-list>span{font:12px monospace;color:#667085}.palette-swatch{width:24px;height:24px;border:2px solid #d0d5dd;border-radius:5px;cursor:pointer}.palette-swatch.selected{outline:2px solid #409eff;outline-offset:2px}.pixel-editor{width:100%;margin:12px 0}.pixel-toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.pixel-grid-layout{display:grid;grid-template-columns:28px minmax(0,1fr);grid-template-rows:20px auto;width:100%}.pixel-ruler-top,.pixel-ruler-left{position:relative;color:#667085;font:10px/1 sans-serif}.pixel-ruler-top{grid-row:1;grid-column:2}.pixel-ruler-top span{position:absolute;bottom:3px;transform:translateX(-50%)}.pixel-ruler-left{grid-row:2;grid-column:1}.pixel-ruler-left span{position:absolute;right:6px;transform:translateY(-50%)}.pixel-board-wrap{grid-row:2;grid-column:2;position:relative;width:100%;aspect-ratio:1;border:1px solid #667085;overflow:hidden;touch-action:none;background:#000}.pixel-board{display:block;width:100%;height:100%;image-rendering:pixelated;touch-action:none;background:transparent}.pixel-grid-overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.pixel-grid-overlay path{fill:none;stroke:#475467;stroke-width:.16;vector-effect:non-scaling-stroke;opacity:.28}.image-crop-editor{margin:4px 0 18px;padding:14px;border:1px solid #e4e7ed;border-radius:8px;background:#fafafa}.image-crop-heading{display:flex;justify-content:space-between;max-width:340px;margin-bottom:10px}.image-crop-heading span,.image-crop-editor small{color:#667085}.image-crop-preview{display:block;width:min(100%,220px);aspect-ratio:1;border:1px solid #98a2b3;background-color:#fff;background-image:linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%);background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0;touch-action:none;cursor:move}.image-crop-editor .el-form-item{max-width:360px;margin:12px 0 0}.image-fit-mode{margin:0 0 10px}.section-array-editor{margin:10px 0}.section-row>*{flex:1}.field-error{display:block;color:#f56c6c;margin:0 0 8px}.request-form .el-select{width:100%}.option-subtitle{float:right;color:#98a2b3}.dimensions{display:flex;gap:14px}.json-view{max-height:300px;overflow:auto;padding:12px;background:#f8fafc;border-radius:6px;font-size:12px}

.audio-workbench-row { display: grid; gap: 12px; }
.recording-card { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin: 0; padding: 10px 0 0; border-top: 1px solid #eef0f3; }
.recording-card h2, .recording-controls { margin: 0; }
.recording-card > .el-form, .recording-card > .el-alert { width: 100%; }
.frame-debug-card { container-type: inline-size; container-name: frame; }
.canvas-editor-layout { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 20px; align-items: start; }
.canvas-resolution { color: #667085; font-size: 12px; font-weight: 400; }
.canvas-settings { display: grid; min-width: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 12px; padding-left: 20px; border-left: 1px solid #eef0f3; align-content: start; }
.canvas-settings-heading { grid-column: 1 / -1; margin: 0; font-size: 13px; font-weight: 600; line-height: 22px; }
.canvas-transfer-heading { margin-top: 4px; padding-top: 14px; border-top: 1px solid #eef0f3; }
.canvas-meta { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; padding: 10px 12px; border-radius: 8px; background: #f7f8fa; }
.canvas-meta > div { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; min-width: 0; }
.canvas-meta dt { color: #667085; font-size: 12px; white-space: nowrap; }
.canvas-meta dd { margin: 0; color: #1d2939; font-size: 12px; font-weight: 600; white-space: nowrap; }
.canvas-settings .palette-colors { flex-wrap: nowrap; gap: 6px; margin: 0; overflow-x: auto; }
.canvas-settings .palette-swatch { width: 22px; height: 22px; padding: 0; border-radius: 3px; flex-shrink: 0; }
.palette-swatch:focus-visible { outline: 2px solid #1677ff; outline-offset: 2px; }
.canvas-settings .el-input-number { width: 100%; max-width: none; }
.canvas-settings .el-select { width: 100%; min-width: 0; max-width: none; }
.canvas-settings .dimensions { display: block; }
.canvas-settings :deep(.el-form-item) { min-width: 0; margin-bottom: 0; }
.canvas-settings :deep(.el-form-item__label) { padding-bottom: 4px; line-height: 20px; }
.canvas-settings :deep(.el-radio-group) { display: flex; flex-wrap: wrap; }
.canvas-settings :deep(.el-radio-button__inner) { padding: 8px 10px; }
.canvas-settings .canvas-palette-control,
.canvas-settings .canvas-send-control,
.canvas-settings .frame-actions,
.canvas-settings > .el-progress { grid-column: 1 / -1; }
.canvas-settings .frame-actions { margin-top: 2px; }
.canvas-settings .canvas-background-control,
.canvas-settings .canvas-brush-control,
.canvas-settings .canvas-duration-control,
.canvas-settings .canvas-fps-control { grid-column: span 1; }
.canvas-settings .dimensions { grid-column: 1 / -1; }
.canvas-settings .canvas-background-control :deep(.el-color-picker) { width: 100%; }
.canvas-settings .canvas-background-control :deep(.el-color-picker__trigger) { width: 100%; }
.pixel-editor { width: min(100%, 520px); min-width: 0; max-width: none; margin: 0 auto; }
.pixel-grid-layout, .pixel-board-wrap { max-width: none; }
.pixel-toolbar { justify-content: flex-end; margin-bottom: 10px; }
.pixel-grid-layout { grid-template-columns: 22px minmax(0, 1fr); grid-template-rows: 16px auto; padding: 0 6px 6px 0; box-sizing: border-box; }
.image-debug-card input[type=file] { width: 100%; min-width: 0; font-size: 12px; }
.image-debug-card .image-crop-editor { margin: 0 0 12px; padding: 0; border: 0; background: transparent; }
.image-debug-card .image-crop-heading { font-size: 12px; }
.canvas-debug-card { width: 100%; min-height: 0; }
.compact-column :deep(.el-form-item) { margin-bottom: 8px; }
.compact-column :deep(.el-form-item__label) { font-size: 12px; line-height: 20px; padding-bottom: 3px; }
.compact-column :deep(.el-form-item__content) { min-width: 0; }
.compact-column :deep(.el-radio-button__inner) { padding: 8px 10px; }
.compact-column input[type=file] { width: 100%; min-width: 0; font-size: 12px; }
.capability-empty { margin: 0; font-size: 12px; line-height: 22px; }
.debug-idle { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; border: 1px dashed #d0d5dd; border-radius: 8px; background: #fff; }
@media (max-width: 1500px) {
  .debug-layout { grid-template-columns: minmax(0, 1fr) 272px; }
  .workspace-columns { grid-template-columns: clamp(420px, 32vw, 500px) minmax(0, 1fr); gap: 12px; }
}
@container controls (max-width: 500px) {
  .section-editor-layout > .el-form { grid-template-columns: minmax(0, 1fr); }
  .section-editor-layout > .el-form > .section-preview { grid-column: 1; grid-row: auto; }
  .section-preview { padding: 10px; }
  .device-preview { min-height: 110px; }
  .control-actions .el-button { max-width: 100%; padding-left: 8px; padding-right: 8px; }
}
@container frame (max-width: 700px) {
  .canvas-editor-layout { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .canvas-settings { padding: 16px 0 0; border-left: 0; border-top: 1px solid #eef0f3; }
  .canvas-transfer-heading { margin-top: 0; }
  .pixel-editor { width: min(100%, 520px); }
}
@container frame (min-width: 780px) {
  .canvas-editor-layout { grid-template-columns: minmax(0, 1fr) 240px; }
  .canvas-settings { grid-template-columns: minmax(0, 1fr); }
}
@container frame (max-width: 460px) {
  .canvas-settings { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .canvas-settings .canvas-palette-control,
  .canvas-settings .canvas-send-control,
  .canvas-settings .frame-actions { grid-column: 1 / -1; }
  .image-form { grid-template-columns: minmax(0, 1fr); }
}
@container frame (max-width: 340px) {
  .canvas-settings { grid-template-columns: minmax(0, 1fr); }
  .image-crop-preview { width: min(100%, 176px); }
}
@media (max-width: 1200px) {
  .debug-workbench { height: auto; min-height: calc(100dvh - 84px); overflow: visible; }
  .debug-layout { grid-template-columns: minmax(0, 1fr); }
  .workspace-columns { height: auto; grid-template-columns: minmax(340px, 1fr) minmax(0, 1.6fr); }
  .compact-column, .canvas-column { overflow: visible; }
}
@media (max-width: 900px) {
  .workspace-columns { grid-template-columns: minmax(0, 1fr); }
  .section-editor-layout { grid-template-columns: minmax(0, 1fr); }
  .image-form { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 700px) {
  .hero { align-items: flex-start; flex-direction: column; }
  .device-picker { width: 100%; }
  .debug-workbench { padding: 12px; }
  .hero h1 { font-size: 20px; }
}
@media (max-width: 400px) {
  .section-editor-layout { grid-template-columns: minmax(0, 1fr); }
  .section-preview { max-width: 176px; }
  .section-row { flex-direction: column; align-items: stretch; }
}

</style>

<style scoped>
.section-preview-title{display:block;width:5em;margin:0 auto 8px}.device-preview li{min-width:0;overflow:hidden;padding:4px 0}.device-preview p{min-width:0;overflow:hidden}
</style>

<style scoped>
.device-preview.gauge-device-preview{width:100%;max-width:256px;min-height:0;aspect-ratio:1;box-sizing:border-box;padding:0;border:0;border-radius:0;background:#000;color:#fff;overflow:hidden}
.gauge-device-preview .section-preview-title{width:5em;max-width:calc(100% - 20px);margin:8px 10px 0;font-size:32px;line-height:1.4;font-weight:400;text-align:left}
</style>
