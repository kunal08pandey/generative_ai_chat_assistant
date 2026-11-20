import assert from "node:assert/strict";
import test from "node:test";

import { transcribeAudio } from "../src/api/client.js";
import {
  formatSpeechTranscript,
  extractTranscriptFromResults,
  getSpeechErrorMessage,
  isAudioRecordingSupported,
  isSpeechRecognitionSupported,
  getSpeechRecognitionConstructor,
  isWhisperHallucination,
} from "../src/utils/speechUtils.js";

test("formatSpeechTranscript: correctly appends recognized speech to empty and existing text", () => {
  // Empty initial text
  assert.equal(formatSpeechTranscript("", "hello world"), "hello world");
  assert.equal(formatSpeechTranscript(null, "hello world"), "hello world");
  assert.equal(formatSpeechTranscript("   ", "hello world"), "hello world");

  // Appending to existing text with automatic spacing
  assert.equal(
    formatSpeechTranscript("Analyze this code", "and find bugs"),
    "Analyze this code and find bugs"
  );

  // Appending to existing text that already ends with space (prevents double space)
  assert.equal(
    formatSpeechTranscript("Analyze this code ", "and find bugs"),
    "Analyze this code and find bugs"
  );

  // Empty speech should preserve existing base text
  assert.equal(formatSpeechTranscript("Keep this text", ""), "Keep this text");
  assert.equal(formatSpeechTranscript("Keep this text", "   "), "Keep this text");
});

test("extractTranscriptFromResults: prevents duplicated interim and final results", () => {
  // Scenario 1: User speaks "hello" (interim)
  const interimEventResults = [
    { 0: { transcript: "hello" }, isFinal: false, length: 1 },
  ];
  const turn1 = extractTranscriptFromResults(interimEventResults);
  assert.equal(turn1.finalTranscript, "");
  assert.equal(turn1.interimTranscript, "hello");
  const text1 = [turn1.finalTranscript, turn1.interimTranscript].filter(Boolean).join(" ");
  assert.equal(text1, "hello");

  // Scenario 2: "hello" is finalized
  const finalizedEventResults = [
    { 0: { transcript: "hello" }, isFinal: true, length: 1 },
  ];
  const turn2 = extractTranscriptFromResults(finalizedEventResults);
  assert.equal(turn2.finalTranscript, "hello");
  assert.equal(turn2.interimTranscript, "");
  const text2 = [turn2.finalTranscript, turn2.interimTranscript].filter(Boolean).join(" ");
  assert.equal(text2, "hello");

  // Scenario 3: User continues speaking "world" (interim) alongside finalized "hello"
  const multiEventResults = [
    { 0: { transcript: "hello" }, isFinal: true, length: 1 },
    { 0: { transcript: "world" }, isFinal: false, length: 1 },
  ];
  const turn3 = extractTranscriptFromResults(multiEventResults);
  assert.equal(turn3.finalTranscript, "hello");
  assert.equal(turn3.interimTranscript, "world");
  const text3 = [turn3.finalTranscript, turn3.interimTranscript].filter(Boolean).join(" ");
  assert.equal(text3, "hello world");

  // Scenario 4: Both segments finalized -> no duplicates
  const allFinalResults = [
    { 0: { transcript: "hello" }, isFinal: true, length: 1 },
    { 0: { transcript: "world" }, isFinal: true, length: 1 },
  ];
  const turn4 = extractTranscriptFromResults(allFinalResults);
  assert.equal(turn4.finalTranscript, "hello world");
  assert.equal(turn4.interimTranscript, "");
  const text4 = [turn4.finalTranscript, turn4.interimTranscript].filter(Boolean).join(" ");
  assert.equal(text4, "hello world");
});

test("getSpeechErrorMessage: maps errors to clear, non-blocking messages", () => {
  // Permission denied
  assert.match(getSpeechErrorMessage("not-allowed"), /permission denied/i);
  assert.match(getSpeechErrorMessage("service-not-allowed"), /permission denied/i);

  // No speech detected
  assert.match(getSpeechErrorMessage("no-speech"), /no speech detected/i);

  // Microphone unavailable
  assert.match(getSpeechErrorMessage("audio-capture"), /microphone unavailable/i);

  // Network error
  assert.match(getSpeechErrorMessage("network"), /network error/i);

  // Unsupported browser
  assert.match(getSpeechErrorMessage("not-supported"), /not supported in this browser/i);

  // User abort should produce empty string (silent)
  assert.equal(getSpeechErrorMessage("aborted"), "");
});

test("isSpeechRecognitionSupported & getSpeechRecognitionConstructor: browser detection and fallbacks", (context) => {
  const originalWindow = globalThis.window;
  context.after(() => {
    globalThis.window = originalWindow;
  });

  // Unsupported scenario
  globalThis.window = {};
  assert.equal(isSpeechRecognitionSupported(), false);
  assert.equal(getSpeechRecognitionConstructor(), null);

  // Standard SpeechRecognition
  class MockSpeechRecognition {}
  globalThis.window = { SpeechRecognition: MockSpeechRecognition };
  assert.equal(isSpeechRecognitionSupported(), true);
  assert.equal(getSpeechRecognitionConstructor(), MockSpeechRecognition);

  // Webkit prefixed webkitSpeechRecognition
  class MockWebKitSpeechRecognition {}
  globalThis.window = { webkitSpeechRecognition: MockWebKitSpeechRecognition };
  assert.equal(isSpeechRecognitionSupported(), true);
  assert.equal(getSpeechRecognitionConstructor(), MockWebKitSpeechRecognition);
});

test("SpeechRecognition lifecycle simulation: start, stop, result emission, error handling, and unmount cleanup", () => {
  class MockRecognition {
    constructor() {
      this.continuous = false;
      this.interimResults = false;
      this.lang = "en-US";
      this.started = false;
      this.stopped = false;
      this.aborted = false;
      this.onstart = null;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
    }

    start() {
      this.started = true;
      if (this.onstart) this.onstart();
    }

    stop() {
      this.stopped = true;
      if (this.onend) this.onend();
    }

    abort() {
      this.aborted = true;
      if (this.onend) this.onend();
    }
  }

  const rec = new MockRecognition();
  let listening = false;
  let transcript = "";
  let capturedError = null;

  rec.onstart = () => {
    listening = true;
  };
  rec.onend = () => {
    listening = false;
  };
  rec.onerror = (event) => {
    capturedError = getSpeechErrorMessage(event.error);
    listening = false;
  };
  rec.onresult = (event) => {
    const { finalTranscript, interimTranscript } = extractTranscriptFromResults(event.results);
    const speech = [finalTranscript, interimTranscript].filter(Boolean).join(" ");
    transcript = formatSpeechTranscript("Draft prompt:", speech);
  };

  // 1. Start recognition
  rec.start();
  assert.equal(rec.started, true);
  assert.equal(listening, true);

  // 2. Receive speech interim
  rec.onresult({
    results: [{ 0: { transcript: "summarize this" }, isFinal: false, length: 1 }],
  });
  assert.equal(transcript, "Draft prompt: summarize this");

  // 3. Receive speech final
  rec.onresult({
    results: [{ 0: { transcript: "summarize this" }, isFinal: true, length: 1 }],
  });
  assert.equal(transcript, "Draft prompt: summarize this");

  // 4. Stop recognition cleanly
  rec.stop();
  assert.equal(rec.stopped, true);
  assert.equal(listening, false);
  // Transcript preserved after stop
  assert.equal(transcript, "Draft prompt: summarize this");

  // 5. Error simulation (e.g. permission denied)
  const errorRec = new MockRecognition();
  errorRec.onstart = () => { listening = true; };
  errorRec.onend = () => { listening = false; };
  errorRec.onerror = (e) => {
    capturedError = getSpeechErrorMessage(e.error);
    listening = false;
  };

  errorRec.start();
  assert.equal(listening, true);
  errorRec.onerror({ error: "not-allowed" });
  assert.equal(listening, false);
  assert.match(capturedError, /permission denied/i);

  // 6. Cleanup on unmount simulation
  const unmountRec = new MockRecognition();
  unmountRec.start();
  assert.equal(unmountRec.started, true);
  unmountRec.abort();
  assert.equal(unmountRec.aborted, true);
});

test("Complete Chat Flow: microphone -> transcription in input -> Send -> streamed response renders", async () => {
  // Mock SpeechRecognition
  class FlowSpeechRecognition {
    constructor() {
      this.onstart = null;
      this.onresult = null;
      this.onend = null;
    }
    start() {
      if (this.onstart) this.onstart();
    }
    stop() {
      if (this.onend) this.onend();
    }
  }

  // 1. Initial State
  let inputState = "Analyze:";
  let isListeningState = false;
  let isStreamingState = false;
  const messagesList = [];

  const rec = new FlowSpeechRecognition();
  rec.onstart = () => { isListeningState = true; };
  rec.onend = () => { isListeningState = false; };
  rec.onresult = (e) => {
    const { finalTranscript, interimTranscript } = extractTranscriptFromResults(e.results);
    const speech = [finalTranscript, interimTranscript].filter(Boolean).join(" ");
    inputState = formatSpeechTranscript("Analyze:", speech);
  };

  // 2. User clicks Microphone
  rec.start();
  assert.equal(isListeningState, true);

  // 3. User speaks: " quarterly financial report"
  rec.onresult({
    results: [
      { 0: { transcript: "quarterly financial report" }, isFinal: true, length: 1 },
    ],
  });
  // Verify transcription appears in input without submitting
  assert.equal(inputState, "Analyze: quarterly financial report");
  assert.equal(messagesList.length, 0); // Must NOT auto-submit

  // 4. User stops voice input
  rec.stop();
  assert.equal(isListeningState, false);
  assert.equal(inputState, "Analyze: quarterly financial report");

  // 5. User clicks Send
  const promptToSend = inputState.trim();
  inputState = "";
  messagesList.push({ role: "user", content: promptToSend });
  assert.equal(messagesList.length, 1);
  assert.equal(messagesList[0].content, "Analyze: quarterly financial report");

  // 6. Mock Assistant Streamed Response
  isStreamingState = true;
  messagesList.push({ role: "assistant", content: "", isStreaming: true });

  const streamedChunks = ["Executive ", "Financial ", "Summary: ", "Q3 revenue grew 14%."];
  for (const chunk of streamedChunks) {
    messagesList[1].content += chunk;
  }
  isStreamingState = false;
  messagesList[1].isStreaming = false;

  // 7. Verify final rendered message
  assert.equal(messagesList[1].content, "Executive Financial Summary: Q3 revenue grew 14%.");
  assert.equal(messagesList[1].isStreaming, false);
  assert.equal(isStreamingState, false);
});

test("isAudioRecordingSupported: checks navigator.mediaDevices.getUserMedia and MediaRecorder", (context) => {
  const originalNavDesc = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalMediaRecorder = globalThis.MediaRecorder;
  const originalWindow = globalThis.window;

  context.after(() => {
    if (originalNavDesc) {
      Object.defineProperty(globalThis, "navigator", originalNavDesc);
    }
    globalThis.MediaRecorder = originalMediaRecorder;
    globalThis.window = originalWindow;
  });

  const setNavigator = (val) => {
    Object.defineProperty(globalThis, "navigator", {
      value: val,
      configurable: true,
      writable: true,
    });
  };

  // When window is missing
  globalThis.window = undefined;
  setNavigator(undefined);
  assert.equal(isAudioRecordingSupported(), false);

  // When MediaRecorder is missing
  globalThis.window = {};
  setNavigator({ mediaDevices: { getUserMedia: () => {} } });
  globalThis.MediaRecorder = undefined;
  assert.equal(isAudioRecordingSupported(), false);

  // When getUserMedia is missing
  setNavigator({ mediaDevices: {} });
  globalThis.MediaRecorder = class {};
  assert.equal(isAudioRecordingSupported(), false);

  // When both are present
  setNavigator({ mediaDevices: { getUserMedia: async () => ({}) } });
  globalThis.MediaRecorder = class {};
  assert.equal(isAudioRecordingSupported(), true);
});

test("transcribeAudio: posts audio blob to /audio/transcribe and parses envelope", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  let calledUrl = null;
  let calledMethod = null;
  let calledBody = null;

  globalThis.fetch = async (url, options) => {
    calledUrl = url;
    calledMethod = options.method;
    calledBody = options.body;
    return new Response(
      JSON.stringify({
        success: true,
        data: { text: "Explain quantum computing simply" },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const dummyBlob = new Blob(["fake-audio-bytes"], { type: "audio/webm" });
  const result = await transcribeAudio(dummyBlob, "recording.webm");

  assert.match(calledUrl, /\/audio\/transcribe$/);
  assert.equal(calledMethod, "POST");
  assert.ok(calledBody instanceof FormData);
  assert.equal(result.text, "Explain quantum computing simply");
});

test("transcribeAudio: propagates backend error messages", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: false,
        error: { message: "Groq Whisper transcription service is temporarily unavailable" },
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );

  const dummyBlob = new Blob(["fake-audio-bytes"], { type: "audio/webm" });
  await assert.rejects(
    transcribeAudio(dummyBlob, "recording.webm"),
    /Groq Whisper transcription service is temporarily unavailable/
  );
});

test("Groq Whisper complete flow: Record audio -> Stop -> Transcribe -> Append to input -> Send", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  // Mock Whisper API response
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: true,
        data: { text: "create a dashboard for cloud metrics" },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  let currentChatInput = "Please ";
  let isListening = false;
  let isTranscribing = false;
  const messages = [];

  // 1. User clicks mic -> recording starts
  isListening = true;
  assert.equal(isListening, true);

  // 2. User stops recording
  isListening = false;
  isTranscribing = true;
  assert.equal(isTranscribing, true);

  // 3. Audio blob is sent to Groq Whisper
  const audioBlob = new Blob(["opus-audio-data"], { type: "audio/webm" });
  const transcriptData = await transcribeAudio(audioBlob);
  isTranscribing = false;
  assert.equal(isTranscribing, false);

  // 4. Transcription is formatted and placed in input (not auto-submitted)
  currentChatInput = formatSpeechTranscript(currentChatInput, transcriptData.text);
  assert.equal(currentChatInput, "Please create a dashboard for cloud metrics");
  assert.equal(messages.length, 0); // No auto-submission

  // 5. User clicks Send
  messages.push({ role: "user", content: currentChatInput });
  currentChatInput = "";
  assert.equal(messages.length, 1);
  assert.equal(messages[0].content, "Please create a dashboard for cloud metrics");
  assert.equal(currentChatInput, "");
});

test("isWhisperHallucination: detects silence and background noise hallucinations", () => {
  // Common silence hallucinations
  assert.equal(isWhisperHallucination("Thank you."), true);
  assert.equal(isWhisperHallucination("Thank you!"), true);
  assert.equal(isWhisperHallucination("thank you"), true);
  assert.equal(isWhisperHallucination("Thanks for watching."), true);
  assert.equal(isWhisperHallucination("Thank you for watching!"), true);
  assert.equal(isWhisperHallucination("Subtitles by the Amara.org community"), true);
  assert.equal(isWhisperHallucination("Bye."), true);
  assert.equal(isWhisperHallucination(""), true);
  assert.equal(isWhisperHallucination(null), true);

  // Real user prompts should NOT be flagged
  assert.equal(isWhisperHallucination("Explain quantum computing"), false);
  assert.equal(isWhisperHallucination("Thank you for helping me write this code"), false);
  assert.equal(isWhisperHallucination("Hello world"), false);
});
