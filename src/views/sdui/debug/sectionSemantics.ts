import type { DebugSectionDisplayField } from './types';

type FieldControl = 'text' | 'textarea' | 'number' | 'switch' | 'select' | 'json';

interface FieldSemanticMeta {
  label: string;
  help?: string;
  placeholder?: string;
  control?: FieldControl;
}

interface SectionSemanticMeta {
  title: string;
  summary: string;
  fieldMap: Record<string, FieldSemanticMeta>;
}

const COMMON_FIELD_MAP: Record<string, FieldSemanticMeta> = {
  tone: {
    label: '状态语义',
    help: '决定卡片或内容的主语义色，例如 primary、success、warning、danger。',
    placeholder: 'primary',
    control: 'text'
  },
  progress: {
    label: '进度百分比',
    help: '通常为 0-100，前端会自动裁剪越界值。',
    placeholder: '0-100',
    control: 'number'
  },
  iconSrc: {
    label: '图标 Key',
    help: '这里通常不是远程 URL，而是图标标识，例如 chat、mail、file。',
    placeholder: 'chat',
    control: 'text'
  },
  iconSymbol: {
    label: '图标符号',
    help: '设备若支持 symbol 风格图标，可在此传图标标识。',
    placeholder: 'love',
    control: 'text'
  }
};

const SECTION_SEMANTICS: Record<string, SectionSemanticMeta> = {
  hero_section: {
    title: '核心指标卡片',
    summary: '展示单个最重要的数据点，通常由大号数值和指标名称组成。',
    fieldMap: {
      value: { label: '主数值', help: '最醒目的核心指标值。', placeholder: '92%' },
      label: { label: '指标名称', help: '说明这个数值代表什么。', placeholder: 'CPU Usage' },
      subtitle: { label: '补充状态', help: '用于展示运行状态或附加说明。', placeholder: 'Running Normal' },
      tone: COMMON_FIELD_MAP.tone,
      iconSrc: COMMON_FIELD_MAP.iconSrc,
      iconSymbol: COMMON_FIELD_MAP.iconSymbol,
      progress: COMMON_FIELD_MAP.progress
    }
  },
  metric_section: {
    title: '多指标卡片',
    summary: '并列展示多个 KPI，适合紧凑的仪表盘指标块。',
    fieldMap: {
      metrics: {
        label: '指标列表',
        help: '逐项添加指标，并分别设置标签和数值。',
        placeholder: '',
        control: 'json'
      }
    }
  },
  chart_section: {
    title: '趋势图表',
    summary: '展示一组趋势点，适合小型折线图或柱状趋势。',
    fieldMap: {
      title: { label: '图表标题', help: '说明趋势图代表的指标。', placeholder: 'CPU Trend' },
      points: {
        label: '趋势点',
        help: '逐项添加趋势图中的数值点。',
        placeholder: '',
        control: 'json'
      },
      progress: COMMON_FIELD_MAP.progress
    }
  },
  progress_section: {
    title: '进度卡片',
    summary: '展示明确的完成进度和进度说明。',
    fieldMap: {
      title: { label: '进度标题', help: '说明当前进度主题。', placeholder: '同步状态' },
      progress: COMMON_FIELD_MAP.progress,
      progressText: { label: '进度文案', help: '例如 42% 或 3 / 10。', placeholder: '42%' }
    }
  },
  text_section: {
    title: '文本卡片',
    summary: '展示标题和正文，用于帮助文案、提示说明或状态解释。',
    fieldMap: {
      title: { label: '标题', help: '文本块主题。', placeholder: '提示' },
      body: {
        label: '正文',
        help: '支持较长说明文案。',
        placeholder: '新的动态内容',
        control: 'textarea'
      }
    }
  },
  timer_section: {
    title: '计时卡片',
    summary: '展示运行时长、运行状态和可选进度。',
    fieldMap: {
      title: { label: '计时标题', help: '说明当前计时场景。', placeholder: '运行时长' },
      progress: COMMON_FIELD_MAP.progress,
      timer: {
        label: '计时对象',
        help: '设置已过毫秒数和运行状态。',
        placeholder: '',
        control: 'json'
      }
    }
  },
  image_section: {
    title: '图标卡片',
    summary: '以图标或图像为主的说明卡片。',
    fieldMap: {
      iconSrc: COMMON_FIELD_MAP.iconSrc,
      title: { label: '标题', help: '主标题。', placeholder: '消息中心' },
      subtitle: { label: '副标题', help: '补充说明。', placeholder: '3 条待处理' }
    }
  },
  overlay_section: {
    title: '浮层提示',
    summary: '居中浮层或告警提示，用于强调确认或通知。',
    fieldMap: {
      title: { label: '通知标题', help: '浮层主题。', placeholder: '设备告警' },
      body: {
        label: '通知正文',
        help: '浮层中显示的主要说明。',
        placeholder: '请立即检查设备状态',
        control: 'textarea'
      },
      tone: COMMON_FIELD_MAP.tone,
      unreadCount: { label: '未读数量', help: '用于角标或提醒。', placeholder: '1', control: 'number' },
      autoHideMs: { label: '自动关闭毫秒', help: '大于 0 时可自动消失。', placeholder: '3000', control: 'number' }
    }
  },
  action_section: {
    title: '操作按钮组',
    summary: '展示一组清晰可点击的操作按钮。',
    fieldMap: {
      actions: {
        label: '按钮列表',
        help: '逐项添加按钮，并设置标识、文本、样式和启用状态。',
        placeholder: '',
        control: 'json'
      }
    }
  },
  toggle_section: {
    title: '开关选项组',
    summary: '展示多个二态选项，用于切换配置或状态。',
    fieldMap: {
      options: {
        label: '开关项列表',
        help: '逐项添加开关选项，并设置标识、文本和状态。',
        placeholder: '',
        control: 'json'
      }
    }
  },
  list_section: {
    title: '列表卡片',
    summary: '展示可点击的项目列表，适合消息、任务或菜单。',
    fieldMap: {
      items: {
        label: '列表项',
        help: '逐项添加列表内容，并设置标题、说明、色调和图标。',
        placeholder: '',
        control: 'json'
      }
    }
  },
  nav_section: {
    title: '标签导航',
    summary: '展示导航标签栏或分段选择器。',
    fieldMap: {
      tabs: {
        label: '标签列表',
        help: '逐项添加导航标签，并设置标识和显示文本。',
        placeholder: '',
        control: 'json'
      },
      activeTab: { label: '当前激活标签', help: '与 tabs[].id 对应。', placeholder: 'overview' }
    }
  }
};

export function getSectionSemantic(type: string) {
  return SECTION_SEMANTICS[type] || {
    title: type,
    summary: '当前类型没有专门的业务语义映射，使用后端返回字段直接编辑。',
    fieldMap: {}
  };
}

export function getFieldSemantic(type: string, field: DebugSectionDisplayField) {
  const section = getSectionSemantic(type);
  const hardcoded = section.fieldMap[field.name] || null;
  // 使用后端 label 作为主源，hardcoded 仅做 fallback
  const label = field.label || hardcoded?.label || humanizeFieldName(field.name);
  const control = hardcoded?.control || inferControl(field);
  return {
    label,
    help: hardcoded?.help || (field.children.length ? '根据字段结构逐项设置内容。' : ''),
    placeholder: hardcoded?.placeholder || field.name,
    control
  };
}

export function inferControl(field: DebugSectionDisplayField): FieldControl {
  if (field.children.length) return 'json';
  if (field.type === 'bool') return 'switch';
  if (field.type === 'enum') return 'select';
  if (field.type === 'int' || field.type === 'float') return 'number';
  if (field.type === 'string') return 'text';
  return 'json';
}

function humanizeFieldName(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}
