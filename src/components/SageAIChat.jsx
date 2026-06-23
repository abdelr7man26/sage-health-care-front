import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMemoryToken } from '../api/tokenStore';

// ─────────────────────────────────────────────────────────────────────────────
// Markdown renderer — handles the AI's 4-part Arabic medical response format
// Supports: **bold** headers, bullet lists, ⚠ warnings, plain paragraphs
// ─────────────────────────────────────────────────────────────────────────────
function parseBold(text) {
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
            ? <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
            : part
    );
}

function MarkdownBlock({ text }) {
    if (!text) return null;
    const nodes = [];
    let key = 0;

    for (const raw of text.split('\n')) {
        const line = raw.trimEnd();

        if (!line.trim()) {
            nodes.push(<div key={key++} className="h-2" />);
            continue;
        }
        if (/^[━─-]{3,}$/.test(line.trim())) {
            nodes.push(<hr key={key++} className="my-2 border-white/10" />);
            continue;
        }
        const boldHeader = line.match(/^\*\*(.+)\*\*$/);
        if (boldHeader) {
            nodes.push(
                <p key={key++} className="font-bold text-emerald-400 text-sm mt-3 mb-1 leading-snug">
                    {boldHeader[1]}
                </p>
            );
            continue;
        }
        const bullet = line.match(/^[-•]\s+(.*)/);
        if (bullet) {
            nodes.push(
                <div key={key++} className="flex items-start gap-2 py-0.5">
                    <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                    <span className="text-sm text-white/80 leading-relaxed">{parseBold(bullet[1])}</span>
                </div>
            );
            continue;
        }
        if (line.startsWith('⚠')) {
            nodes.push(
                <p key={key++} className="text-xs text-amber-400 bg-amber-900/25 border border-amber-500/25 rounded-xl px-3 py-2 mt-2 leading-relaxed">
                    {parseBold(line)}
                </p>
            );
            continue;
        }
        nodes.push(
            <p key={key++} className="text-sm text-white/80 leading-relaxed">{parseBold(line)}</p>
        );
    }
    return <div className="space-y-0.5">{nodes}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Typing indicator
// ─────────────────────────────────────────────────────────────────────────────
function TypingIndicator() {
    return (
        <div className="flex items-end gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-full bg-[#134e3a] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-[14px]">smart_toy</span>
            </div>
            <div className="bg-white/[.07] border border-white/[.1] rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                        <span key={i} className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"
                            style={{ animationDelay: `${i * 0.16}s`, animationDuration: '0.8s' }} />
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI response sanitiser — strip hallucinated non-Arabic/Latin scripts.
// Blacklist approach: removes specific bad script ranges so emojis and all
// Markdown symbols are always preserved naturally.
// ─────────────────────────────────────────────────────────────────────────────
function sanitiseAIResponse(text) {
    if (!text) return text;
    return text
        .replace(/[Ѐ-ӿԀ-ԯ]/g, '')  // Cyrillic (Russian, Bulgarian…)
        .replace(/[฀-๿]/g, '')                // Thai
        .replace(/[　-鿿]/g, '')                // CJK Unified Ideographs + misc
        .replace(/[가-힯]/g, '')                // Korean Hangul
        .replace(/[぀-ヿ]/g, '')                // Hiragana / Katakana
        .replace(/[豈-﫿]/g, '')                // CJK Compatibility Ideographs
        .replace(/[ऀ-ॿ]/g, '')                // Devanagari (Hindi)
        .replace(/[^\S\n]+/g, ' ')                      // collapse spaces, keep newlines
        .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// STT helper — strip unexpected scripts from speech transcript
// Chrome's STT engine sometimes misrecognises Arabic phonemes and outputs
// Chinese, Japanese, or other CJK characters. This whitelist approach keeps
// only Arabic, Latin, digits, spaces, and common punctuation.
// ─────────────────────────────────────────────────────────────────────────────
function cleanSpeechTranscript(text) {
    return text
        // Keep Arabic (all blocks) + Latin + digits + spaces + common punctuation
        .replace(
            /[^؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿a-zA-Z0-9\s.,،؟?!؛;:()-]/g,
            ''
        )
        .replace(/\s+/g, ' ')   // collapse multiple spaces
        .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// TTS helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * extractArabicOnly
 * Pulls out ONLY Arabic word sequences from the raw AI response and joins
 * them with single spaces.  Everything else — English words, digits, slashes,
 * parentheses, Markdown markers, box-drawing glyphs — is discarded before the
 * string ever reaches speechSynthesis, so the engine never tries to pronounce
 * non-Arabic characters.
 *
 * Covered Unicode blocks:
 *   ؀-ۿ  Arabic (basic block — letters, diacritics, punctuation)
 *   ݐ-ݿ  Arabic Supplement
 *   ࢠ-ࣿ  Arabic Extended-A
 *   ﭐ-﷿  Arabic Presentation Forms-A
 *   ﹰ-﻿  Arabic Presentation Forms-B
 */
const ARABIC_TOKEN_RE =
    /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]+/g;

function extractArabicOnly(text) {
    const tokens = text.match(ARABIC_TOKEN_RE) || [];
    return tokens.join(' ');
}

/**
 * getVoicesAsync
 * Chrome/Edge load voices asynchronously; getVoices() returns [] on the first
 * call.  This helper waits for onvoiceschanged and resolves once the list is
 * populated (or after a 2-second safety timeout so we never block forever).
 */
function getVoicesAsync() {
    return new Promise((resolve) => {
        const immediate = window.speechSynthesis.getVoices();
        if (immediate.length > 0) { resolve(immediate); return; }

        const onChanged = () => {
            window.speechSynthesis.removeEventListener('voiceschanged', onChanged);
            clearTimeout(timer);
            resolve(window.speechSynthesis.getVoices());
        };
        window.speechSynthesis.addEventListener('voiceschanged', onChanged);

        // Safety net — 2 s max wait
        const timer = setTimeout(() => {
            window.speechSynthesis.removeEventListener('voiceschanged', onChanged);
            resolve(window.speechSynthesis.getVoices()); // return whatever is there
        }, 2000);
    });
}

/**
 * pickArabicVoice
 * Walks the priority list and returns the best available Arabic voice:
 *   1. ar-SA exact match  (most natural for MSA / medical text)
 *   2. ar-EG exact match
 *   3. Any ar-* local (on-device) voice
 *   4. Any ar-* voice (cloud / remote)
 *   5. null  → browser uses its default (may still work on some platforms)
 */
function pickArabicVoice(voices) {
    return (
        voices.find((v) => v.lang === 'ar-SA') ||
        voices.find((v) => v.lang === 'ar-EG') ||
        voices.find((v) => v.lang.startsWith('ar') && v.localService) ||
        voices.find((v) => v.lang.startsWith('ar')) ||
        null
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Message bubble
// ─────────────────────────────────────────────────────────────────────────────
function MessageBubble({ msg, userInitial, isSpeaking, onSpeak }) {
    if (msg.streaming && !msg.content) return <TypingIndicator />;

    if (msg.role === 'user') {
        return (
            <div className="flex items-end justify-end gap-2 mb-4">
                <div className="max-w-[72%] bg-[#134e3a] text-white rounded-2xl rounded-br-sm px-4 py-3">
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                    <p className="text-[10px] text-emerald-200 mt-1">{msg.time}</p>
                </div>
                <div className="w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center shrink-0 text-white font-bold text-xs">
                    {userInitial}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-end gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-full bg-[#134e3a] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-[14px]">smart_toy</span>
            </div>
            <div className="flex-1 bg-white/[.07] border border-white/[.1] rounded-2xl rounded-bl-sm px-4 py-3.5">
                {msg.error
                    ? <div className="flex items-center gap-2 text-red-600">
                        <span className="material-symbols-outlined text-[15px]">error</span>
                        <p className="text-sm">{msg.content}</p>
                      </div>
                    : <>
                        <MarkdownBlock text={msg.content} />
                        {msg.streaming && (
                            <span className="inline-block w-0.5 h-4 bg-emerald-400 animate-pulse ml-0.5 align-middle" />
                        )}
                      </>
                }

                {/* ── Bubble footer: metadata + TTS button ───────────────────── */}
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/[.08]">
                    <p className="text-[10px] text-white/35">
                        {msg.model ? `${msg.model} · ${msg.time}` : msg.time}
                    </p>

                    {/* Speaker button — only on non-error messages */}
                    {!msg.error && (
                        <button
                            onClick={onSpeak}
                            title={isSpeaking ? 'إيقاف القراءة' : 'استمع للرد'}
                            className={`
                                relative flex items-center justify-center w-6 h-6 rounded-lg
                                transition-all duration-200
                                ${isSpeaking
                                    ? 'text-emerald-400'
                                    : 'text-white/25 hover:text-emerald-400 hover:bg-emerald-900/30'
                                }
                            `}
                        >
                            {/* Subtle pulse ring visible only while speaking */}
                            {isSpeaking && (
                                <span className="absolute inset-0 rounded-lg bg-emerald-400/20 animate-ping pointer-events-none" />
                            )}
                            <span className="material-symbols-outlined text-[17px] relative z-10">
                                {isSpeaking ? 'volume_off' : 'volume_up'}
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick symptom prompts (shown in empty state)
// ─────────────────────────────────────────────────────────────────────────────
const SYMPTOM_CHIPS = [
    { ar: 'عندي ضغط وصداع مش بيمشي',          en: 'Blood pressure & headache'   },
    { ar: 'معدتي بتوجعني وعندي غازات',         en: 'Stomach pain & bloating'     },
    { ar: 'حاسس بتعب وإرهاق من غير سبب',      en: 'Fatigue & weakness'          },
    { ar: 'عندي ألم في ظهري من فترة طويلة',   en: 'Chronic back pain'           },
];

// ─────────────────────────────────────────────────────────────────────────────
// SageAIChat — dashboard card widget
//
// Designed to sit inside a fixed-height parent card.
// The parent provides the border, shadow, and rounded corners.
// Internal layout:
//   ┌─ messages (flex-1, overflow-y-auto) ─┐
//   ├─ disclaimer (shrink-0) ──────────────┤
//   └─ input bar  (shrink-0) ──────────────┘
// ─────────────────────────────────────────────────────────────────────────────

// Browser support check — webkitSpeechRecognition is the widest-compatible API.
const SpeechRecognitionAPI =
    typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

export default function SageAIChat({ userName }) {
    const navigate = useNavigate();

    const [messages, setMessages]         = useState([]);
    const [input, setInput]               = useState('');
    const [loading, setLoading]           = useState(false);
    const [isListening, setIsListening]   = useState(false);
    const [speakingId, setSpeakingId]     = useState(null);   // index of msg being spoken

    const messagesRef      = useRef(null);  // scrollable messages container
    const historyRef       = useRef([]);    // shadow copy for API history
    const inputRef         = useRef(null);
    const abortRef         = useRef(null);
    const recognitionRef   = useRef(null);
    // Typewriter animation refs — decouple stream speed from display speed
    const twBufferRef      = useRef('');   // full accumulated content from API
    const twDisplayedRef   = useRef(0);    // chars shown so far
    const twTimerRef       = useRef(null); // setTimeout handle
    const twStreamIdRef    = useRef(null); // which message is being typed
    const utteranceRef   = useRef(null);
    const baseInputRef   = useRef('');   // snapshot of textarea when mic is pressed
    const committedRef   = useRef('');   // all finalized speech in the current session
    const silenceTimerRef = useRef(null); // auto-stop after silence

    // Keep historyRef in sync with messages so sendMessage can read current history
    // without needing to put messages in its dependency array or use state updaters
    // for side-effect-laden work (which React StrictMode double-invokes).
    useEffect(() => {
        historyRef.current = messages;
    }, [messages]);

    // Clean up typewriter timer on unmount
    useEffect(() => () => clearTimeout(twTimerRef.current), []);

    // Scroll only the chat container — never the outer page.
    useEffect(() => {
        const el = messagesRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [messages, loading]);

    const sendMessage = useCallback(async (queryText) => {
        const query = (queryText ?? input).trim();
        if (!query || loading) return;

        setInput('');
        const now     = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        const history = historyRef.current.map(({ role, content }) => ({ role, content }));

        setMessages((prev) => [...prev, { role: 'user', content: query, time: now }]);
        setLoading(true);

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const streamId = `stream-${Date.now()}`;
        setMessages((m) => [...m, { id: streamId, role: 'ai', content: '', streaming: true, time: now, error: false }]);

        // ── Typewriter animation ──────────────────────────────────────────────
        // Buffer holds all content received from the API.
        // The animation loop reveals it 3 chars at a time at ~60 fps,
        // so the text appears to be typed regardless of network chunk size.
        twBufferRef.current   = '';
        twDisplayedRef.current = 0;
        twStreamIdRef.current  = streamId;

        const CHARS_PER_TICK = 1;   
        const TICK_MS        = 30; 
        const runTypewriter = () => {
            const full      = twBufferRef.current;
            const displayed = twDisplayedRef.current;
            if (displayed < full.length) {
                const next = Math.min(displayed + CHARS_PER_TICK, full.length);
                twDisplayedRef.current = next;
                setMessages((m) => m.map((msg) =>
                    msg.id === twStreamIdRef.current
                        ? { ...msg, content: full.slice(0, next) }
                        : msg
                ));
            }
            twTimerRef.current = setTimeout(runTypewriter, TICK_MS);
        };
        twTimerRef.current = setTimeout(runTypewriter, TICK_MS);
        // ─────────────────────────────────────────────────────────────────────

        const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const token   = getMemoryToken();

        try {
            const response = await fetch(`${baseURL}/ai/stream`, {
                method:  'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body:        JSON.stringify({ query, history }),
                signal:      controller.signal,
                credentials: 'include',
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const reader  = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer    = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const payload = line.slice(6).trim();
                    if (payload === '[DONE]') break;
                    try {
                        const parsed = JSON.parse(payload);
                        if (parsed.error) throw new Error(parsed.error);
                        if (parsed.delta) {
                            // Just feed the buffer — the animation loop does the display
                            twBufferRef.current += parsed.delta;
                        }
                    } catch { /* skip malformed chunk */ }
                }
            }

            // Wait for the typewriter to finish displaying all received content
            await new Promise((resolve) => {
                const check = () => {
                    if (twDisplayedRef.current >= twBufferRef.current.length) {
                        resolve();
                    } else {
                        setTimeout(check, TICK_MS * 2);
                    }
                };
                check();
            });

            clearTimeout(twTimerRef.current);

            const aiTime     = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            const finalText  = sanitiseAIResponse(twBufferRef.current) || 'لم يتمكن المساعد من إنشاء رد. حاول مرة أخرى.';
            setMessages((m) => m.map((msg) =>
                msg.id === streamId
                    ? { ...msg, content: finalText, streaming: false, time: aiTime }
                    : msg
            ));

        } catch (err) {
            clearTimeout(twTimerRef.current);
            if (err.name === 'AbortError') return;
            const errTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            setMessages((m) => m.map((msg) =>
                msg.id === streamId
                    ? { ...msg, content: 'تعذر الاتصال بالمساعد الطبي.', streaming: false, time: errTime, error: true }
                    : msg
            ));
        } finally {
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 80);
        }
    }, [input, loading]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    const clearChat = () => {
        // Abort any in-flight stream request
        abortRef.current?.abort();
        // Stop the typewriter animation
        clearTimeout(twTimerRef.current);
        twBufferRef.current    = '';
        twDisplayedRef.current = 0;
        // Stop voice input and TTS
        recognitionRef.current?.stop();
        stopSpeech();
        // Reset UI state
        setMessages([]);
        setLoading(false);
        inputRef.current?.focus();
    };

    // ── Voice-to-Text ─────────────────────────────────────────────────────────
    const toggleListening = useCallback(() => {
        if (!SpeechRecognitionAPI) {
            alert('متصفحك لا يدعم التعرف على الصوت. يُرجى استخدام Google Chrome.');
            return;
        }

        // ── Stop if already listening ─────────────────────────────────────────
        if (isListening) {
            recognitionRef.current?.stop();
            return;
        }

        // ── Start a new recognition session ──────────────────────────────────
        const recognition = new SpeechRecognitionAPI();

        recognition.lang            = 'ar-EG';
        recognition.continuous      = true;   // don't let the browser cut us off mid-sentence
        recognition.interimResults  = true;   // stream live transcript so user sees it as they speak
        recognition.maxAlternatives = 1;

        // Snapshot what was already typed before the mic was pressed.
        baseInputRef.current = input;
        committedRef.current = '';   // finalized speech for this session

        // ── Silence detection ─────────────────────────────────────────────────
        // Reset the 1.5 s countdown every time new speech arrives.
        // When it fires the user has genuinely stopped talking → stop recognition.
        const SILENCE_MS = 1500;
        const resetSilenceTimer = () => {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
                recognition.stop();
            }, SILENCE_MS);
        };

        recognition.onstart = () => {
            setIsListening(true);
            resetSilenceTimer();   // start the very first countdown on session open
        };

        recognition.onresult = (e) => {
            resetSilenceTimer();   // user is still speaking — restart the countdown

            let finalChunk   = '';
            let interimChunk = '';

            for (let i = e.resultIndex; i < e.results.length; i++) {
                const text = cleanSpeechTranscript(e.results[i][0].transcript);
                if (e.results[i].isFinal) {
                    finalChunk += text;
                } else {
                    interimChunk += text;
                }
            }

            if (finalChunk) {
                committedRef.current = committedRef.current
                    ? `${committedRef.current} ${finalChunk.trim()}`
                    : finalChunk.trim();
            }

            const sessionText = committedRef.current + (interimChunk ? ` ${interimChunk}` : '');
            const newInput    = baseInputRef.current
                ? `${baseInputRef.current} ${sessionText}`
                : sessionText;

            setInput(newInput.trimStart());

            requestAnimationFrame(() => {
                if (inputRef.current) {
                    inputRef.current.style.height = 'auto';
                    inputRef.current.style.height =
                        Math.min(inputRef.current.scrollHeight, 100) + 'px';
                }
            });
        };

        recognition.onerror = (e) => {
            clearTimeout(silenceTimerRef.current);
            setIsListening(false);
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                alert('لم يتم السماح باستخدام الميكروفون. افتح إعدادات المتصفح وأذن بالوصول للميك.');
            } else if (e.error !== 'no-speech') {
                console.warn('[SageAIChat] Speech recognition error:', e.error);
            }
        };

        recognition.onend = () => {
            clearTimeout(silenceTimerRef.current);
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
    }, [isListening, input]);

    // Stop recognition and clear the silence timer if the component unmounts
    useEffect(() => {
        return () => {
            clearTimeout(silenceTimerRef.current);
            recognitionRef.current?.stop();
        };
    }, []);

    // ── Text-to-Speech ────────────────────────────────────────────────────────
    const speak = useCallback(async (text, msgId) => {
        if (!window.speechSynthesis) return;

        // ── Toggle off ───────────────────────────────────────────────────────
        if (speakingId === msgId) {
            window.speechSynthesis.cancel();
            setSpeakingId(null);
            return;
        }

        // ── Cancel anything currently playing ────────────────────────────────
        window.speechSynthesis.cancel();

        // ── Extract ONLY Arabic characters — drop English, digits, slashes ───
        const arabicText = extractArabicOnly(text);
        if (!arabicText) return;   // message had no Arabic content at all

        // ── Show indicator immediately (before the async voice-load) ─────────
        setSpeakingId(msgId);

        // ── Wait for voices (Chrome returns [] on first synchronous call) ────
        const voices      = await getVoicesAsync();
        const chosenVoice = pickArabicVoice(voices);

        if (chosenVoice) {
            console.info('[TTS] voice →', chosenVoice.name, `(${chosenVoice.lang})`);
        } else {
            console.warn(
                '[TTS] No Arabic voice available.',
                'Install one: Windows Settings → Time & Language → Language & Region → Arabic → Text-to-speech.'
            );
        }

        // ── Build and fire the utterance ─────────────────────────────────────
        const utterance  = new SpeechSynthesisUtterance(arabicText);
        utterance.lang   = 'ar-SA';   // force Arabic locale on the utterance
        utterance.rate   = 0.88;      // slightly slower sounds more natural for Arabic
        utterance.pitch  = 1.0;
        utterance.volume = 1.0;

        // Explicitly set voice — without this Chrome often falls back to English
        if (chosenVoice) utterance.voice = chosenVoice;

        utterance.onend   = () => setSpeakingId(null);
        utterance.onerror = (e) => {
            if (e.error !== 'interrupted') console.warn('[TTS] error:', e.error);
            setSpeakingId(null);
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
    }, [speakingId]);

    // Cancel any ongoing speech when the component unmounts
    useEffect(() => {
        return () => { window.speechSynthesis?.cancel(); };
    }, []);

    // Also cancel speech when the chat is cleared
    const stopSpeech = () => {
        if (speakingId !== null) {
            window.speechSynthesis?.cancel();
            setSpeakingId(null);
        }
    };

    const isEmpty      = messages.length === 0;
    const userInitial  = (userName || 'U').charAt(0).toUpperCase();

    return (
        <div className="relative flex flex-col h-full w-full bg-transparent overflow-hidden">

            {/* ── Idle animated background — visible only when chat is empty ── */}
            {isEmpty && (
                <>
                    <style>{`
                        @keyframes chatParticleRise {
                            0%   { transform: translateY(0) scale(1);   opacity: 0;   }
                            12%  { opacity: .7; }
                            80%  { opacity: .25; }
                            100% { transform: translateY(-220px) scale(.4); opacity: 0; }
                        }
                        @keyframes chatOrb1 {
                            0%,100% { transform: translate(-50%,-50%) scale(1);    opacity: .18; }
                            50%     { transform: translate(-48%,-52%) scale(1.18); opacity: .28; }
                        }
                        @keyframes chatOrb2 {
                            0%,100% { transform: translate(-50%,-50%) scale(1.05); opacity: .10; }
                            50%     { transform: translate(-52%,-48%) scale(.9);   opacity: .20; }
                        }
                        @keyframes chatGridFade {
                            0%,100% { opacity: .08; }
                            50%     { opacity: .18; }
                        }
                        @keyframes chatRingPulse {
                            0%   { transform: translate(-50%,-50%) scale(.6); opacity: .5; }
                            100% { transform: translate(-50%,-50%) scale(1.8); opacity: 0; }
                        }
                    `}</style>

                    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden" aria-hidden>

                        {/* Dot grid */}
                        <div style={{
                            position:'absolute', inset:0,
                            backgroundImage:'radial-gradient(circle, rgba(52,211,153,.13) 1px, transparent 1px)',
                            backgroundSize:'28px 28px',
                            animation:'chatGridFade 4s ease-in-out infinite',
                        }}/>

                        {/* Primary center glow */}
                        <div style={{
                            position:'absolute', top:'42%', left:'50%',
                            width:'380px', height:'380px', borderRadius:'50%',
                            background:'radial-gradient(circle, rgba(52,211,153,.35) 0%, rgba(52,211,153,.1) 45%, transparent 70%)',
                            animation:'chatOrb1 6s ease-in-out infinite',
                            willChange:'transform',
                        }}/>

                        {/* Secondary glow */}
                        <div style={{
                            position:'absolute', top:'58%', left:'32%',
                            width:'240px', height:'240px', borderRadius:'50%',
                            background:'radial-gradient(circle, rgba(26,107,78,.45) 0%, transparent 70%)',
                            animation:'chatOrb2 9s ease-in-out infinite',
                            willChange:'transform',
                        }}/>

                        {/* Tertiary glow top-right */}
                        <div style={{
                            position:'absolute', top:'20%', right:'10%',
                            width:'180px', height:'180px', borderRadius:'50%',
                            background:'radial-gradient(circle, rgba(52,211,153,.25) 0%, transparent 70%)',
                            animation:'chatOrb2 12s ease-in-out 3s infinite',
                            willChange:'transform',
                        }}/>

                        {/* Expanding ring 1 */}
                        <div style={{
                            position:'absolute', top:'42%', left:'50%',
                            width:'60px', height:'60px', borderRadius:'50%',
                            border:'1.5px solid rgba(52,211,153,.7)',
                            animation:'chatRingPulse 3s ease-out infinite',
                        }}/>
                        {/* Expanding ring 2 — delayed */}
                        <div style={{
                            position:'absolute', top:'42%', left:'50%',
                            width:'60px', height:'60px', borderRadius:'50%',
                            border:'1.5px solid rgba(52,211,153,.5)',
                            animation:'chatRingPulse 3s ease-out 1.5s infinite',
                        }}/>

                        {/* Floating particles */}
                        {[
                            { left:'10%', bottom:'8%',  s:4, d:7.0, dl:0.0,  c:'rgba(52,211,153,.85)'  },
                            { left:'24%', bottom:'15%', s:3, d:8.5, dl:1.4,  c:'rgba(255,255,255,.65)' },
                            { left:'40%', bottom:'5%',  s:5, d:6.0, dl:0.7,  c:'rgba(52,211,153,.80)'  },
                            { left:'58%', bottom:'12%', s:3, d:9.0, dl:2.1,  c:'rgba(255,255,255,.60)' },
                            { left:'74%', bottom:'7%',  s:4, d:7.5, dl:0.3,  c:'rgba(52,211,153,.75)'  },
                            { left:'88%', bottom:'22%', s:3, d:6.5, dl:3.0,  c:'rgba(255,255,255,.65)' },
                            { left:'16%', bottom:'40%', s:3, d:8.0, dl:1.0,  c:'rgba(52,211,153,.70)'  },
                            { left:'50%', bottom:'35%', s:4, d:7.0, dl:2.6,  c:'rgba(255,255,255,.55)' },
                            { left:'67%', bottom:'48%', s:3, d:9.5, dl:0.5,  c:'rgba(52,211,153,.70)'  },
                            { left:'82%', bottom:'55%', s:4, d:6.0, dl:1.9,  c:'rgba(255,255,255,.60)' },
                            { left:'33%', bottom:'60%', s:3, d:8.5, dl:3.5,  c:'rgba(52,211,153,.75)'  },
                            { left:'5%',  bottom:'65%', s:3, d:7.5, dl:0.9,  c:'rgba(255,255,255,.55)' },
                            { left:'92%', bottom:'70%', s:4, d:6.5, dl:2.3,  c:'rgba(52,211,153,.65)'  },
                            { left:'45%', bottom:'75%', s:3, d:8.0, dl:4.0,  c:'rgba(255,255,255,.50)' },
                        ].map((p, i) => (
                            <div key={i} style={{
                                position:'absolute',
                                left: p.left, bottom: p.bottom,
                                width: p.s + 'px', height: p.s + 'px',
                                borderRadius:'50%',
                                background: p.c,
                                boxShadow: i % 3 === 0 ? `0 0 6px ${p.c}` : 'none',
                                animation:`chatParticleRise ${p.d}s linear ${p.dl}s infinite`,
                                willChange:'transform',
                            }}/>
                        ))}
                    </div>
                </>
            )}

            {/* ── Scrollable messages area ─────────────────────────────────────
                flex-1 + overflow-y-auto: grows to fill space, scrolls internally.
            ──────────────────────────────────────────────────────────────────── */}
            <div ref={messagesRef} className="relative z-10 flex-1 overflow-y-auto px-5 py-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-emerald-700/50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-emerald-600/70">

                {/* ── Empty state — matches the screenshot layout ─────────────── */}
                {isEmpty && (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-0">

                        {/* Robot icon */}
                        <div className="w-16 h-16 rounded-2xl bg-[#134e3a] flex items-center justify-center mb-5 shadow-md">
                            <span className="material-symbols-outlined text-white text-[32px]">smart_toy</span>
                        </div>

                        {/* Heading */}
                        <h3 className="text-xl font-black text-white mb-2 tracking-tight">
                            كيف يمكنني مساعدتك؟
                        </h3>
                        <p className="text-white/50 text-sm mb-7 max-w-xs leading-relaxed">
                            أنا SAGE، مساعدك الصحي الذكي. يمكنني تحليل الأعراض،
                            إيجاد الأطباء، وإدارة سجلاتك الطبية في ثوانٍ.
                        </p>

                        {/* Quick-action nav pills — matching the screenshot */}
                        <div className="flex flex-wrap justify-center gap-2.5 mb-7">
                            <button
                                onClick={() => sendMessage('أريد فحص أعراضي')}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/[.15] hover:border-emerald-500/50 hover:bg-emerald-900/30 text-sm font-semibold text-white/65 hover:text-emerald-300 transition-all"
                            >
                                <span className="material-symbols-outlined text-[17px]">monitor_heart</span>
                                تحليل الأعراض
                            </button>
                            <button
                                onClick={() => navigate('/doctors')}
                                className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/[.15] hover:border-emerald-500/50 hover:bg-emerald-900/30 text-sm font-semibold text-white/65 hover:text-emerald-300 transition-all"
                            >
                                <span className="material-symbols-outlined text-[17px]">person_search</span>
                                ابحث عن طبيب
                            </button>
                        </div>

                        {/* Symptom chips */}
                        <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                            {SYMPTOM_CHIPS.map(({ ar }) => (
                                <button
                                    key={ar}
                                    onClick={() => sendMessage(ar)}
                                    disabled={loading}
                                    className="group text-right bg-white/[.06] hover:bg-emerald-900/30 border border-white/[.1] hover:border-emerald-500/40 rounded-xl px-3.5 py-2 transition-all"
                                >
                                    <span className="text-xs font-semibold text-white/65 group-hover:text-emerald-300">{ar}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Conversation ────────────────────────────────────────────── */}
                {messages.map((msg, i) => (
                    <MessageBubble
                        key={i}
                        msg={msg}
                        userInitial={userInitial}
                        isSpeaking={speakingId === i}
                        onSpeak={() => speak(msg.content, i)}
                    />
                ))}
                {loading && !messages.some((m) => m.streaming) && <TypingIndicator />}
            </div>

            {/* ── Disclaimer ─────────────────────────────────────────────────── */}
            <div className="relative z-10 shrink-0 bg-amber-900/20 border-t border-amber-500/20 px-5 py-1.5">
                <p className="text-[10px] text-amber-400/80 text-center">
                    ⚠️ للإرشاد فقط — ليس تشخيصاً طبياً. استشر طبيبك دائماً.
                </p>
            </div>

            {/* ── Input bar ──────────────────────────────────────────────────────
                shrink-0 keeps it pinned to the bottom of the card at all times.
            ──────────────────────────────────────────────────────────────────── */}
            <div className="relative z-10 shrink-0 bg-transparent border-t border-white/[.08] px-5 py-4">
                <div className="flex items-end gap-2.5">

                    {/* Clear chat — only when messages exist */}
                    {!isEmpty && (
                        <button onClick={clearChat} title="Clear chat"
                            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-white/[.08] hover:bg-red-900/30 hover:text-red-400 text-white/40 transition-all">
                            <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                        </button>
                    )}

                    {/* Textarea — matches the screenshot's wide input */}
                    <textarea
                        ref={inputRef}
                        rows={1}
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                        }}
                        onKeyDown={handleKeyDown}
                        disabled={loading}
                        placeholder="اكتب استفسارك الصحي..."
                        dir="auto"
                        className="flex-1 resize-none bg-white/[.07] border border-white/[.12] focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-all leading-relaxed disabled:opacity-60 [&::-webkit-scrollbar]:hidden"
                        style={{ minHeight: '42px', maxHeight: '100px', scrollbarWidth: 'none' }}
                    />

                    {/* ── Microphone button ──────────────────────────────────────
                        Hidden when the browser doesn't support the API at all.
                        Active (listening) state: red background + pulse ring.
                        Idle state: gray, turns emerald on hover.
                    ──────────────────────────────────────────────────────────── */}
                    {SpeechRecognitionAPI && (
                        <button
                            onClick={toggleListening}
                            disabled={loading}
                            title={isListening ? 'إيقاف الاستماع' : 'تحدث الآن (عربي / English)'}
                            className={`
                                relative w-10 h-10 shrink-0 flex items-center justify-center rounded-xl
                                transition-all duration-200 disabled:cursor-not-allowed
                                ${isListening
                                    ? 'bg-red-500 text-white shadow-md shadow-red-900/30'
                                    : 'bg-white/[.08] text-white/50 hover:bg-emerald-900/30 hover:text-emerald-400'
                                }
                            `}
                        >
                            {/* Pulse ring while listening */}
                            {isListening && (
                                <span className="absolute inset-0 rounded-xl bg-red-400 animate-ping opacity-40 pointer-events-none" />
                            )}
                            <span className="material-symbols-outlined text-[20px] relative z-10">
                                {isListening ? 'mic_off' : 'mic'}
                            </span>
                        </button>
                    )}

                    {/* Send button — matches the screenshot's green pill button */}
                    <button
                        onClick={() => sendMessage()}
                        disabled={loading || !input.trim()}
                        className="w-10 h-10 shrink-0 flex items-center justify-center bg-[#1a6b4e] hover:bg-[#134e3a] disabled:bg-white/[.1] disabled:cursor-not-allowed text-white rounded-xl transition-all active:scale-95"
                        title="Send"
                    >
                        {loading
                            ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                            : <span className="material-symbols-outlined text-[20px]">send</span>
                        }
                    </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 text-center">
                    {isListening
                        ? '🔴 Listening… speak now'
                        : 'Enter to send · Shift+Enter for new line · 🎙 mic for voice'}
                </p>
            </div>
        </div>
    );
}
