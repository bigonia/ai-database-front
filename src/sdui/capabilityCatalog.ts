/** Platform-owned capability mapping shared by the debugger and business editor. */
export type CapabilitySurface = 'debug' | 'business';

export const capabilityRecipes = {
  'audio.record': ['audio.capture.start', 'audio.capture.stop', 'audio.capture.toggle'],
  'audio.play': ['audio.playback.start', 'audio.playback.stop'],
  'ui.show': ['display.section.set'],
  'image.show': ['display.image.begin', 'display.image.end'],
  'canvas.play': ['display.canvas.open', 'display.canvas.close']
} as const;

const hiddenCommands = new Set([
  'business.scenes.replace', 'business.reset', 'business.trigger',
  'device.schema.get', 'device.schemas.ready', 'business.interaction'
]);
const debugOnlyCommands = new Set(['system.reboot', 'system.provisioning.start']);
const packagedCommands: Set<string> = new Set(Object.values(capabilityRecipes).flat());

export function isVisibleDirectCommand(name: string, surface: CapabilitySurface): boolean {
  return !hiddenCommands.has(name) && !packagedCommands.has(name)
    && (surface === 'debug' || !debugOnlyCommands.has(name));
}

export function supportsCapability(commands: Iterable<string>, capability: keyof typeof capabilityRecipes): boolean {
  const declared = new Set(commands);
  if (capability === 'audio.record') return declared.has('audio.capture.start') && declared.has('audio.capture.stop');
  return capabilityRecipes[capability].every(command => declared.has(command));
}

export const businessActionLabels: Record<string, string> = {
  'audio.record': '音频采集', 'audio.play': '音频播放', 'ui.show': '界面显示',
  'image.show': '图片显示', 'canvas.play': 'Canvas 播放',
  'system.volume.set': '设置音量', 'system.brightness.set': '设置亮度',
  'feedback.rgb.set': '设置灯光', 'feedback.rgb.off': '关闭灯光'
};
export function isBusinessRecipe(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(capabilityRecipes, name);
}

/** Business-facing actions hide conversions already wrapped by audio capture/playback. */
export function isVisibleBusinessAction(name: string): boolean {
  return !['ai.stt', 'ai.tts'].includes(name)
    && (isBusinessRecipe(name) || isVisibleDirectCommand(name, 'business'));
}
