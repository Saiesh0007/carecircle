// Voice input: records a short clip with MediaRecorder and transcribes it with Whisper (via our API).
import { api } from './api.js';
import { toast } from './ui.js';
import { t } from './i18n.js';

const MAX_MS = 30000;
export const voiceSupported = () =>
  Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

/** First audio container this browser can record that Whisper accepts. */
function pickMime() {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return options.find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
}

/** Wire a mic button: first press starts recording, second press stops and fills the target input. */
export function attachMic(button, target, onText) {
  if (!voiceSupported()) {
    button.hidden = true;
    return;
  }
  let recorder = null;
  let chunks = [];
  let timer = null;

  async function start() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast(t('micDenied'), { error: true });
      return;
    }
    const mime = pickMime();
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((tr) => tr.stop());
      button.classList.remove('recording');
      button.setAttribute('aria-pressed', 'false');
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      if (blob.size < 1200) {
        return;
      }
      button.classList.add('busy');
      try {
        const { text } = await api('/api/ai/transcribe', {
          method: 'POST',
          raw: blob,
          contentType: blob.type.split(';')[0],
        });
        if (text) {
          target.value = target.value ? `${target.value} ${text}` : text;
          target.dispatchEvent(new Event('input'));
          target.focus();
          onText?.(text);
        }
      } catch (e) {
        toast(e.message, { error: true });
      } finally {
        button.classList.remove('busy');
      }
    };
    recorder.start();
    button.classList.add('recording');
    button.setAttribute('aria-pressed', 'true');
    toast(t('listening'), { ms: 2200 });
    timer = setTimeout(stop, MAX_MS);
  }
  function stop() {
    clearTimeout(timer);
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    }
  }

  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () =>
    recorder && recorder.state === 'recording' ? stop() : start(),
  );
}
