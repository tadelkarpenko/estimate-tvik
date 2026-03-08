import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Minus, X, Send, Maximize2 } from 'lucide-react';
import mascotImg from '@/assets/mascot_taz_spin.png';

type Msg = { role: 'user' | 'assistant'; content: string };

export function FloatingAIWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const estimateMatch = location.pathname.match(/\/estimates\/(.+)/);
  const contractMatch = location.pathname.match(/\/contracts\/(.+)/);
  const contextLabel = estimateMatch ? `Estimate: ${estimateMatch[1]}` : contractMatch ? `Contract: ${contractMatch[1]}` : 'General';

  // Hide on estimate pages — the inline AI launcher handles it there
  const isEstimatePage = location.pathname.startsWith('/estimates/') || location.pathname === '/estimates/new';
  if (isEstimatePage && !open) return null;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { setMessages([]); }, [location.pathname]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming) return;
    const userMsg: Msg = { role: 'user', content: input };
    const allMsgs = [...messages, userMsg];
    setMessages(allMsgs);
    setInput('');
    setStreaming(true);

    let assistantContent = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'chat',
          data: {
            messages: allMsgs.map(m => ({ role: m.role, content: m.content })),
            context: { route: location.pathname, context_type: contextLabel },
          },
        }),
      });

      if (!resp.ok || !resp.body) throw new Error('Stream failed');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ') || line.trim() === '' || line.startsWith(':')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: assistantContent };
                return copy;
              });
            }
          } catch { /* partial */ }
        }
      }
    } catch {
      assistantContent = 'Sorry, I encountered an error. Please try again.';
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: assistantContent };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, messages, location.pathname, contextLabel]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105 overflow-hidden border-2 border-primary/30 bg-card"
        aria-label="Open AI Assistant"
      >
        <img src={mascotImg} alt="AI Assistant" className="w-full h-full object-cover" />
      </button>
    );
  }

  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-card border rounded-full shadow-lg px-4 py-2">
        <img src={mascotImg} alt="AI" className="w-5 h-5 rounded-full object-cover" />
        <span className="text-xs font-medium">AI Assistant</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setMinimized(false)}>
          <Maximize2 className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setOpen(false); setMinimized(false); }}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[380px] h-[70vh] sm:h-[500px] max-h-[500px] bg-card border rounded-xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-primary/5">
        <div className="flex items-center gap-2">
          <img src={mascotImg} alt="AI" className="w-6 h-6 rounded-full object-cover" />
          <span className="text-sm font-semibold">TVIK AI</span>
          <Badge variant="outline" className="text-xs">{contextLabel}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setMinimized(true)}>
            <Minus className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              Ask about scope, costs, missing items, or any estimate/contract question.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`p-2.5 rounded-lg text-sm ${
                m.role === 'user' ? 'bg-primary/10 ml-6' : 'bg-muted mr-4'
              }`}
            >
              <div className="prose prose-sm max-w-none text-foreground">
                <ReactMarkdown>{m.content || '...'}</ReactMarkdown>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="flex gap-2 p-3 border-t">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask anything..."
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          disabled={streaming}
          className="text-sm"
        />
        <Button size="icon" onClick={sendMessage} disabled={!input.trim() || streaming}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
