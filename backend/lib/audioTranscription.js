/**
 * audioTranscription.js — Download and transcribe audio via OpenAI Whisper.
 */

export async function downloadAndTranscribe(url, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  // Download audio
  const audioRes = await fetch(url);
  if (!audioRes.ok) throw new Error(`Audio download failed: ${audioRes.status}`);
  const audioBuffer = await audioRes.arrayBuffer();

  // Detect extension from URL or content-type
  const contentType = audioRes.headers.get('content-type') || 'audio/ogg';
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  const filename = ['ogg','mp3','mp4','webm','wav','m4a','flac'].includes(ext)
    ? `audio.${ext}`
    : 'audio.ogg';

  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: contentType }), filename);
  form.append('model', 'whisper-1');
  form.append('language', options.language || 'es');
  if (options.prompt) form.append('prompt', options.prompt);

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Whisper API ${res.status}: ${err}`);
  }

  const data = await res.json();
  return (data.text || '').trim();
}
