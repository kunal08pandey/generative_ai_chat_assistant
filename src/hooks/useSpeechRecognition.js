import { useState, useRef, useEffect, useCallback } from "react";
import { transcribeAudio } from "../api/client";
import {
  formatSpeechTranscript,
  isAudioRecordingSupported,
} from "../utils/speechUtils";

export function useSpeechRecognition({ onTranscript, disabled = false } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speechError, setSpeechError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const baseTextRef = useRef("");
  const errorTimerRef = useRef(null);
  const onTranscriptRef = useRef(onTranscript);
  const disabledRef = useRef(disabled);
  const canceledRef = useRef(false);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const clearSpeechError = useCallback(() => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    setSpeechError(null);
  }, []);

  const showSpeechError = useCallback((message) => {
    if (!message) return;
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }
    setSpeechError(message);
    errorTimerRef.current = setTimeout(() => {
      setSpeechError(null);
      errorTimerRef.current = null;
    }, 6000);
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      streamRef.current = null;
    }
  }, []);

  const stopListening = useCallback((cancel = false) => {
    canceledRef.current = cancel;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    cleanupStream();
    setIsListening(false);
  }, [cleanupStream]);

  useEffect(() => {
    disabledRef.current = disabled;
    if (disabled && isListening) {
      stopListening(true);
    }
  }, [disabled, isListening, stopListening]);

  const startListening = useCallback(async (currentInputText = "") => {
    clearSpeechError();

    if (disabledRef.current) {
      return;
    }

    if (!isAudioRecordingSupported()) {
      showSpeechError("Microphone recording is not supported in this browser.");
      return;
    }

    // Stop any existing session
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      stopListening(true);
    }

    baseTextRef.current = currentInputText || "";
    audioChunksRef.current = [];
    canceledRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = "";
      let ext = "webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
          ext = "webm";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
          ext = "webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
          ext = "mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
          ext = "ogg";
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        setIsListening(true);
        clearSpeechError();
      };

      mediaRecorder.onstop = async () => {
        setIsListening(false);
        cleanupStream();

        if (canceledRef.current) {
          audioChunksRef.current = [];
          return;
        }

        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];

        if (!chunks || chunks.length === 0) {
          return;
        }

        const audioBlob = new Blob(chunks, { type: mimeType || "audio/webm" });
        if (audioBlob.size < 200) {
          return;
        }

        setIsTranscribing(true);
        try {
          const res = await transcribeAudio(audioBlob, `speech.${ext}`);
          const text = (res?.text || res?.data?.text || "").trim();
          if (text) {
            const combined = formatSpeechTranscript(baseTextRef.current, text);
            if (onTranscriptRef.current) {
              onTranscriptRef.current(combined);
            }
          }
        } catch (err) {
          showSpeechError(err.message || "Failed to transcribe audio with Whisper.");
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.onerror = (event) => {
        setIsListening(false);
        cleanupStream();
        showSpeechError(event.error?.message || "Recording error occurred.");
      };

      mediaRecorder.start(250); // Slice into 250ms chunks
    } catch (err) {
      cleanupStream();
      setIsListening(false);

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        showSpeechError("Microphone permission denied. Please allow microphone access in your browser.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        showSpeechError("No microphone found. Please connect a microphone and try again.");
      } else {
        showSpeechError(err.message || "Could not access microphone.");
      }
    }
  }, [clearSpeechError, cleanupStream, showSpeechError, stopListening]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      cleanupStream();
    };
  }, [cleanupStream]);

  return {
    isListening,
    isTranscribing,
    speechError,
    startListening,
    stopListening,
    clearSpeechError,
  };
}
