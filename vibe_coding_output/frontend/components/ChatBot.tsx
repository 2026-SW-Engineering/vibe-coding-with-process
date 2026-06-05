"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface TokenState {
  input: number;
  output: number;
  cache_creation: number;
  cache_read: number;
}

const QUICK_QUESTIONS = [
  "게이밍 장비 추천해줘",
  "5만원 이하 선물 추천",
  "운동할 때 필요한 것들",
  "홈오피스 세팅 도와줘",
];

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface Props {
  initialMessage?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatBot({ initialMessage, isOpen, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(generateSessionId);
  const [tokens, setTokens] = useState<TokenState>({ input: 0, output: 0, cache_creation: 0, cache_read: 0 });
  const [totalMessages, setTotalMessages] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialSent = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      if (messages.length === 0) {
        setMessages([{
          role: "assistant",
          content: "안녕하세요! 저는 VibeMall AI 쇼핑 어시스턴트입니다 😊\n원하시는 상품이나 예산을 알려주시면 딱 맞는 상품을 추천해드릴게요!",
        }]);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialMessage && isOpen && !initialSent.current) {
      initialSent.current = true;
      handleSend(initialMessage);
    }
  }, [initialMessage, isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const userMsg: Message = { role: "user", content };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const apiMessages = updatedMessages
        .filter(m => m.role !== "assistant" || m.content !== "안녕하세요! 저는 VibeMall AI 쇼핑 어시스턴트입니다 😊\n원하시는 상품이나 예산을 알려주시면 딱 맞는 상품을 추천해드릴게요!")
        .map(m => ({ role: m.role, content: m.content }));

      const res = await api.chat.send(apiMessages, sessionId);

      setMessages(prev => [...prev, { role: "assistant", content: res.reply }]);

      setTokens(prev => ({
        input: prev.input + res.usage.input_tokens,
        output: prev.output + res.usage.output_tokens,
        cache_creation: prev.cache_creation + res.usage.cache_creation_input_tokens,
        cache_read: prev.cache_read + res.usage.cache_read_input_tokens,
      }));
      setTotalMessages(prev => prev + 1);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "오류가 발생했습니다";
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const estimatedCost = (
    (tokens.input * 3.0 + tokens.output * 15.0 + tokens.cache_creation * 3.75 + tokens.cache_read * 0.3) / 1_000_000
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-end p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/20 sm:bg-transparent" onClick={onClose} />
      <div className="relative w-full sm:w-96 h-[90vh] sm:h-[600px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-xl">🤖</div>
              <div>
                <p className="font-bold text-white text-sm">AI 쇼핑 어시스턴트</p>
                <p className="text-indigo-200 text-xs">VibeMall 전문 추천봇</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Token Usage */}
          {totalMessages > 0 && (
            <div className="bg-white/10 rounded-xl p-2.5 text-xs text-white">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-indigo-100">토큰 사용량 ({totalMessages}회 대화)</span>
                <span className="text-yellow-300 font-bold">${estimatedCost.toFixed(5)}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-indigo-200">
                <span>입력: <span className="text-white font-medium">{tokens.input.toLocaleString()}</span></span>
                <span>출력: <span className="text-white font-medium">{tokens.output.toLocaleString()}</span></span>
                {tokens.cache_read > 0 && <span>캐시(읽기): <span className="text-green-300 font-medium">{tokens.cache_read.toLocaleString()}</span></span>}
                {tokens.cache_creation > 0 && <span>캐시(생성): <span className="text-yellow-300 font-medium">{tokens.cache_creation.toLocaleString()}</span></span>}
              </div>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0 mt-1">
                  🤖
                </div>
              )}
              <div
                className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-sm"
                    : "bg-slate-100 text-slate-800 rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0">
                🤖
              </div>
              <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick Questions */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-slate-400 mb-2">빠른 질문</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full border border-indigo-200 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-slate-200">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="메시지를 입력하세요..."
              disabled={loading}
              className="flex-1 bg-slate-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-50"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-xl flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
