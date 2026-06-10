/**
 * 前端命令注册表 — 命令展示名称、分组、参数约束与枚举值
 *
 * 后端仅返回 { command, params: [{name, type}] }，所有 UI 元数据由此表维护。
 * 实际可执行命令以接口返回的 deviceCommands 为准（后端已按设备能力过滤）。
 */
import type { DebugCommandParamMeta } from './types';

export interface CommandRegistryEntry {
  /** 命令标识，与后端 command 字段对应 */
  command: string;
  /** 前端展示名称 */
  displayName: string;
  /** 分组（用于命令面板分组展示） */
  group: string;
  /** 描述 */
  description: string;
  /** 参数元数据（含约束与枚举值），key 为 param.name */
  paramMeta: Record<string, DebugCommandParamMeta>;
}

const REGISTRY: CommandRegistryEntry[] = [
  // ── 显示 ──
  {
    command: 'display.brightness.set',
    displayName: '设置屏幕亮度',
    group: '显示',
    description: '调节屏幕亮度百分比',
    paramMeta: {
      value: { required: true, min: 0, max: 100, default: 50 }
    }
  },

  // ── 设备 ──
  {
    command: 'device.reboot',
    displayName: '远程重启',
    group: '设备',
    description: '远程重启设备',
    paramMeta: {}
  },

  // ── 音频 ──
  {
    command: 'audio.volume.set',
    displayName: '设置音量',
    group: '音频',
    description: '设置扬声器音量百分比',
    paramMeta: {
      value: { required: true, min: 0, max: 100, default: 50 }
    }
  },
  {
    command: 'audio.prompt.play',
    displayName: '播放提示音',
    group: '音频',
    description: '播放预设提示音效',
    paramMeta: {
      preset: {
        required: true,
        enumValues: [
          { label: '通知', value: 'notification' },
          { label: '成功', value: 'success' },
          { label: '错误', value: 'error' },
          { label: '警告', value: 'warning' },
          { label: '点击', value: 'click' },
          { label: '蜂鸣', value: 'beep' }
        ],
        default: 'notification'
      }
    }
  },
  {
    command: 'audio.tts.speak',
    displayName: 'TTS 语音播报',
    group: '音频',
    description: '将文本转为语音播报',
    paramMeta: {
      text: { required: true, default: '' }
    }
  },

  // ── RGB 灯光 ──
  {
    command: 'rgb.effect.set',
    displayName: 'RGB 灯光效果',
    group: 'RGB 灯光',
    description: '设置 RGB 灯光效果模式及颜色参数',
    paramMeta: {
      mode: {
        required: false,
        enumValues: [
          { label: '常亮单色', value: 'solid' },
          { label: '闪烁', value: 'blink' },
          { label: '呼吸渐变', value: 'breathe' },
          { label: '彩虹渐变', value: 'rainbow' },
          { label: '流水灯', value: 'chase' }
        ],
        default: 'solid'
      },
      r: { required: true, min: 0, max: 255, default: 255 },
      g: { required: true, min: 0, max: 255, default: 0 },
      b: { required: true, min: 0, max: 255, default: 0 },
      brightness: { required: false, min: 0, max: 255, default: 120 },
      period_ms: { required: false, min: 200, max: 5000, default: 1200 },
      step_ms: { required: false, min: 10, max: 500, default: 40 }
    }
  },
  {
    command: 'rgb.off',
    displayName: '关闭 RGB 灯光',
    group: 'RGB 灯光',
    description: '关闭所有 RGB 灯光',
    paramMeta: {}
  }
];

/** 以 command 为 key 的快速查找 Map */
const registryMap = new Map<string, CommandRegistryEntry>();
REGISTRY.forEach((entry) => {
  registryMap.set(entry.command, entry);
});

/** 根据 command 字符串查找注册表条目 */
export function getCommandEntry(command: string): CommandRegistryEntry | undefined {
  return registryMap.get(command);
}

/** 获取全部注册表条目 */
export function getAllCommandEntries(): CommandRegistryEntry[] {
  return REGISTRY;
}
