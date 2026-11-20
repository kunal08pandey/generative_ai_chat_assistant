/**
 * Speech Recognition Utilities
 * ============================
 * Helper functions for Web Speech API transcription, interim deduplication,
 * and friendly error mapping.
 */

export const WHISPER_HALLUCINATIONS = new Set([
  "thank you",
  "thank you very much",
  "thanks for watching",
  "thank you for watching",
  "please subscribe",
  "subscribe to my channel",
  "subtitles by",
  "bye",
  "bye bye",
  "goodbye",
  "you",
]);

/**
 * Detect Whisper hallucination phrases on silence or ambient noise.
 */
export function isWhisperHallucination(text = "") {
  if (!text || !text.trim()) return true;
  const clean = text
    .toLowerCase()
    .replace(/[.!?,:;~_"'()[\]]/g, "")
    .trim();
  if (WHISPER_HALLUCINATIONS.has(clean)) return true;
  if (clean.startsWith("subtitles by")) return true;
  return false;
}

/**
 * Check if the browser supports standard audio recording (MediaRecorder).
 */
export function isAudioRecordingSupported() {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  return Boolean(navigator?.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
}

/**
 * Check if the browser supports SpeechRecognition or webkitSpeechRecognition.
 */
export function isSpeechRecognitionSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Get the SpeechRecognition constructor (standard or webkit prefix).
 */
export function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * Safely format and append new speech text to existing input text without
 * duplicate spaces or awkward punctuation spacing.
 */
export function formatSpeechTranscript(baseText = "", speechText = "") {
  const trimmedSpeech = (speechText || "").trim();
  if (!trimmedSpeech) return baseText || "";
  const rawBase = baseText || "";
  if (!rawBase.trim()) return trimmedSpeech;

  // Add a space if base text does not end with whitespace
  const needsSpace = !/\s$/.test(rawBase);
  return rawBase + (needsSpace ? " " : "") + trimmedSpeech;
}

/**
 * Extract final and interim transcripts from SpeechRecognitionResultList.
 * Iterates through all available results to ensure that interim updates
 * replace previous interim updates and never duplicate final text.
 */
export function extractTranscriptFromResults(results) {
  let finalTranscript = "";
  let interimTranscript = "";

  if (!results) return { finalTranscript: "", interimTranscript: "" };

  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    if (!item || !item[0]) continue;
    const text = (item[0].transcript || "").trim();
    if (!text) continue;

    if (item.isFinal) {
      finalTranscript = (finalTranscript ? `${finalTranscript} ` : "") + text;
    } else {
      interimTranscript = (interimTranscript ? `${interimTranscript} ` : "") + text;
    }
  }

  return { finalTranscript, interimTranscript };
}

/**
 * Map Web Speech API error codes to helpful, non-blocking user messages.
 */
export function getSpeechErrorMessage(errorType) {
  switch (errorType) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission denied. Please allow microphone access in your browser settings.";
    case "no-speech":
      return "No speech detected. Please check your microphone and try speaking again.";
    case "audio-capture":
      return "Microphone unavailable. Please verify your microphone is plugged in and working.";
    case "network":
      return "Speech recognition network error. In Brave or privacy-focused browsers, enable 'Google services for speech recognition' in settings, or check your internet connection.";
    case "not-supported":
      return "Speech recognition is not supported in this browser. Please use Chrome, Edge, or a Chromium-based browser.";
    case "aborted":
      return ""; // User/system intentional abort - no error to display
    default:
      return `Speech recognition error (${errorType}). Please try again.`;
  }
}
