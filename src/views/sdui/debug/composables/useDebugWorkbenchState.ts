import { reactive, ref } from 'vue';
import type { SectionTemplate } from '@/types/sdui-business';
import type { DebugAvailableRequests, DebugJournalEntry, DebugRequestResult } from '@/types/sdui-debug';
import type { SduiDeviceOption } from '@/types/sdui-device';
import type { DebugFrameCapabilities } from '@/sdui/debugDeviceContext';
import type { DebugPixelChange } from '@/sdui/debugCanvas';
import type { ChartFields } from '../../components/chartSections';

type DebugSectionDraft = ChartFields & { text?: string; description?: string };

const defaultPalette = ['#ffffff', '#000000', '#ff0000', '#0000ff', '#00ff00', '#ffff00', '#00ffff', '#ff00ff', '#808080', '#c0c0c0', '#800000', '#008000', '#000080', '#808000', '#008080', '#800080'];

export function useDebugWorkbenchState() {
  const device = {
    devices: ref<SduiDeviceOption[]>([]),
    deviceId: ref(''),
    loading: ref(false),
    loadingDevices: ref(false),
    sending: ref(false),
    error: ref(''),
    deviceListError: ref(''),
    available: ref<DebugAvailableRequests | null>(null)
  };

  const requests = {
    directoryLoading: ref(false),
    directoryError: ref(''),
    history: ref<DebugJournalEntry[]>([]),
    historyLoading: ref(false),
    historyError: ref(''),
    detailLoading: ref(false),
    detailError: ref(''),
    name: ref(''),
    params: ref<Record<string, unknown>>({}),
    jsonDrafts: ref<Record<string, string>>({}),
    paramErrors: ref<Record<string, string>>({}),
    selectedHistory: ref<DebugJournalEntry | DebugRequestResult | null>(null)
  };

  const sections = {
    catalog: ref<Record<string, SectionTemplate>>({}),
    catalogError: ref(''),
    type: ref('text_section'),
    values: reactive<DebugSectionDraft>({}),
    rows: ref<Record<string, unknown>[]>([]),
    fieldErrors: ref<Record<string, string>>({}),
    supportedTypes: ref<string[] | null>(null),
    capabilityError: ref(''),
    capabilityReady: ref(false),
    sending: ref(false)
  };

  const view = {
    stateLoading: ref(false),
    stateError: ref(''),
    frameCapabilities: ref<DebugFrameCapabilities | null>(null),
    capabilityError: ref(''),
    mode: ref<'image' | 'canvas'>('image'),
    sessionOpen: ref(false),
    frameCount: ref(0)
  };

  const image = {
    sizes: [16, 32, 64, 128],
    spec: ref({ width: 128, height: 128 }),
    paletteCount: ref(16),
    file: ref<File | null>(null),
    cropCanvas: ref<HTMLCanvasElement | null>(null),
    previewReady: ref(false),
    cropError: ref(''),
    cropZoom: ref(1),
    cropX: ref(0),
    cropY: ref(0),
    cropSize: ref(0),
    fitMode: ref<'contain' | 'cover'>('contain'),
    cropDrag: ref<{ clientX: number; clientY: number; x: number; y: number } | null>(null)
  };
  const canvas = {
    spec: ref({ width: 128, height: 128, maxFps: 10 }),
    paletteCount: ref(16),
    defaultPalette,
    colors: ref([...defaultPalette]),
    paletteFromSession: ref(false),
    backgroundColor: ref('#ffffff'),
    board: ref<HTMLCanvasElement | null>(null),
    pixels: ref<Uint8Array>(new Uint8Array(128 * 128)),
    strokes: ref<DebugPixelChange[][]>([]),
    selectedColorIndex: ref(1),
    brushSize: ref(1),
    sendMode: ref<'final' | 'process'>('final'),
    playbackSeconds: ref(4),
    strokeActive: ref(false),
    lastPaintPoint: ref<{ x: number; y: number } | null>(null),
    playbackActive: ref(false),
    playbackProgress: ref(0),
    stopPlayback: ref(false)
  };

  const audio = {
    recordingText: ref(''),
    recordingArtifact: ref(''),
    recordingTranscribing: ref(false),
    recordingError: ref(''),
    recordingActive: ref(false),
    recordingStatus: ref(''),
    recordingSending: ref(false),
    source: ref<'text' | 'file' | 'tone'>('text'),
    file: ref<File | null>(null),
    text: ref('你好，这是一条终端音频播放测试。'),
    loading: ref(false),
    toneLoading: ref(''),
    status: ref(''),
    statusType: ref<'success' | 'error' | 'info' | 'warning'>('info')
  };

  const action = {
    values: reactive<Record<string, Record<string, unknown>>>({}),
    errors: reactive<Record<string, Record<string, string>>>({}),
    sending: ref(''),
    submitError: ref('')
  };

  return { device, requests, sections, view, image, canvas, audio, action };
}
