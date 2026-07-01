import { useEffect, useRef, useState } from 'react';

export function useChatComposer({ isBusy, onSendChat }: { isBusy: boolean; onSendChat: (prompt: string) => void }) {
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 168)}px`;
  }, [prompt]);

  const submit = () => {
    const value = prompt.trim();
    if (!value || isBusy) return;
    onSendChat(value);
    setPrompt('');
  };

  return { prompt, setPrompt, textareaRef, submit };
}
