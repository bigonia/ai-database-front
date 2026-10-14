import { nextTick, watch, type Ref } from 'vue';
import { errorDetails } from '@/utils/errorDetails';
import { getDebugImageCropReset, getDebugImageSourceRect, type ImageFitMode } from '@/sdui/debugImage';

interface DebugImageEditorState {
  spec: Ref<{ width: number; height: number }>;
  file: Ref<File | null>;
  cropCanvas: Ref<HTMLCanvasElement | null>;
  previewReady: Ref<boolean>;
  cropError: Ref<string>;
  cropZoom: Ref<number>;
  cropX: Ref<number>;
  cropY: Ref<number>;
  cropSize: Ref<number>;
  fitMode: Ref<ImageFitMode>;
  cropDrag: Ref<{ clientX: number; clientY: number; x: number; y: number } | null>;
}

export function useDebugImageEditor(state: DebugImageEditorState) {
  let bitmap: ImageBitmap | null = null;

  function sourceRect(source: ImageBitmap) {
    return getDebugImageSourceRect({
      bitmapWidth: source.width,
      bitmapHeight: source.height,
      targetWidth: state.spec.value.width,
      targetHeight: state.spec.value.height,
      fitMode: state.fitMode.value,
      zoom: state.cropZoom.value,
      x: state.cropX.value,
      y: state.cropY.value
    });
  }

  function drawPreview() {
    const canvas = state.cropCanvas.value;
    if (!canvas || !bitmap) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    const source = sourceRect(bitmap);
    context.drawImage(bitmap, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);
  }

  function resetCrop() {
    if (!bitmap) return;
    const crop = getDebugImageCropReset({
      bitmapWidth: bitmap.width,
      bitmapHeight: bitmap.height,
      targetWidth: state.spec.value.width,
      targetHeight: state.spec.value.height,
      fitMode: state.fitMode.value
    });
    state.cropZoom.value = crop.zoom;
    state.cropX.value = crop.x;
    state.cropY.value = crop.y;
    state.cropSize.value = crop.size;
  }

  function clearBitmap() {
    bitmap?.close();
    bitmap = null;
    state.previewReady.value = false;
  }

  function selectFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    input.value = '';
    state.file.value = file;
    state.cropError.value = '';
    clearBitmap();
    state.cropZoom.value = 1;
    state.cropX.value = 0;
    state.cropY.value = 0;
    state.cropSize.value = 0;
    if (!file) return;
    createImageBitmap(file).then(image => {
      if (state.file.value !== file) {
        image.close();
        return;
      }
      bitmap = image;
      state.previewReady.value = true;
      resetCrop();
      void nextTick(drawPreview);
    }).catch(cause => {
      if (state.file.value === file) {
        state.previewReady.value = false;
        state.cropError.value = errorDetails(cause).message || '无法读取所选图片';
      }
    });
  }

  function startDrag(event: PointerEvent) {
    if (!bitmap || !state.cropCanvas.value) return;
    event.preventDefault();
    state.cropDrag.value = { clientX: event.clientX, clientY: event.clientY, x: state.cropX.value, y: state.cropY.value };
    state.cropCanvas.value.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent) {
    const canvas = state.cropCanvas.value;
    const drag = state.cropDrag.value;
    if (!drag || !bitmap || !canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const source = sourceRect(bitmap);
    const scale = source.width / bounds.width;
    const maxX = Math.max(0, bitmap.width - source.width);
    const maxY = Math.max(0, bitmap.height - source.height);
    state.cropX.value = Math.max(0, Math.min(maxX, drag.x - (event.clientX - drag.clientX) * scale));
    state.cropY.value = Math.max(0, Math.min(maxY, drag.y - (event.clientY - drag.clientY) * scale));
    drawPreview();
  }

  function setZoom(value: number) {
    if (!bitmap) return;
    state.cropZoom.value = value;
    drawPreview();
  }

  watch(state.fitMode, () => {
    if (!bitmap) return;
    resetCrop();
    drawPreview();
  });

  return {
    sourceRect,
    selectFile,
    startDrag,
    moveDrag,
    finishDrag: () => { state.cropDrag.value = null; },
    setZoom,
    clearBitmap,
    getBitmap: () => bitmap
  };
}
