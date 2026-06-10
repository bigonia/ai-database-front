import { computed, onBeforeUnmount, ref } from 'vue';
import { openSduiSseStream } from '@/api/sdui';
import { normalizeCommandHistoryItem, normalizeEventItem } from '../normalize';
import type { DebugCommandHistoryItem, DebugEventStreamItem } from '../types';

export function useDebugStreams() {
  const commandConnected = ref(false);
  const eventConnected = ref(false);
  const commandAborter = ref<AbortController | null>(null);
  const eventAborter = ref<AbortController | null>(null);

  const streamSummary = computed(() => [
    { key: 'command', label: '命令回执流', connected: commandConnected.value },
    { key: 'event', label: '事件观测流', connected: eventConnected.value }
  ]);

  function stopAllStreams() {
    commandAborter.value?.abort();
    eventAborter.value?.abort();
    commandAborter.value = null;
    eventAborter.value = null;
    commandConnected.value = false;
    eventConnected.value = false;
  }

  function startCommandStream(deviceId: string, onRecord: (item: DebugCommandHistoryItem) => void) {
    commandAborter.value?.abort();
    commandAborter.value = new AbortController();
    commandConnected.value = false;
    openSduiSseStream(`/api/v1/sdui/debug/${deviceId}/commands/stream`, {
      signal: commandAborter.value.signal,
      onEvent: ({ event, data }) => {
        if (event === 'connected') {
          commandConnected.value = true;
          return;
        }
        if (event === 'command_result') {
          commandConnected.value = true;
          onRecord(normalizeCommandHistoryItem(data));
        }
      }
    }).catch(() => {
      commandConnected.value = false;
    });
  }

  function startEventStream(deviceId: string, onRecord: (item: DebugEventStreamItem) => void) {
    eventAborter.value?.abort();
    eventAborter.value = new AbortController();
    eventConnected.value = false;
    openSduiSseStream(`/api/v1/sdui/debug/${deviceId}/events/stream`, {
      signal: eventAborter.value.signal,
      onEvent: ({ event, data }) => {
        if (event === 'connected') {
          eventConnected.value = true;
          return;
        }
        eventConnected.value = true;
        onRecord(normalizeEventItem(event, data));
      }
    }).catch(() => {
      eventConnected.value = false;
    });
  }

  onBeforeUnmount(() => {
    stopAllStreams();
  });

  return {
    commandConnected,
    eventConnected,
    streamSummary,
    startCommandStream,
    startEventStream,
    stopAllStreams
  };
}
