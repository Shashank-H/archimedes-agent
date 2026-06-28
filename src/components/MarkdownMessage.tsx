import type { ReactNode } from 'react';

type MarkdownMessageProps = {
  content: string;
};

type MessageSegment =
  | { type: 'markdown'; content: string }
  | { type: 'thinking'; content: string; complete: boolean };

function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));

    if (match[2]) nodes.push(<strong key={match.index}>{match[2]}</strong>);
    else if (match[3]) nodes.push(<em key={match.index}>{match[3]}</em>);
    else if (match[4]) nodes.push(<code key={match.index}>{match[4]}</code>);
    else if (match[5] && match[6]) {
      nodes.push(
        <a key={match.index} href={match[6]} target="_blank" rel="noreferrer">
          {match[5]}
        </a>,
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function renderParagraph(lines: string[], key: string) {
  return <p key={key}>{parseInline(lines.join(' '))}</p>;
}

function splitThinkingSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const pattern = /<think\b[^>]*>/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content))) {
    if (match.index > cursor) {
      segments.push({ type: 'markdown', content: content.slice(cursor, match.index) });
    }

    const thinkingStart = pattern.lastIndex;
    const closeMatch = /<\/think>/i.exec(content.slice(thinkingStart));
    if (!closeMatch) {
      segments.push({ type: 'thinking', content: content.slice(thinkingStart), complete: false });
      cursor = content.length;
      break;
    }

    const thinkingEnd = thinkingStart + closeMatch.index;
    segments.push({ type: 'thinking', content: content.slice(thinkingStart, thinkingEnd), complete: true });
    cursor = thinkingEnd + closeMatch[0].length;
    pattern.lastIndex = cursor;
  }

  if (cursor < content.length) {
    segments.push({ type: 'markdown', content: content.slice(cursor) });
  }

  return segments.filter((segment) => segment.content.trim().length > 0);
}

function renderMarkdownContent(content: string) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let index = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(renderParagraph(paragraph, `p-${index++}`));
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const fence = trimmed.match(/^```(\w+)?\s*$/);
    if (fence) {
      flushParagraph();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i += 1;
      }
      blocks.push(
        <pre key={`code-${index++}`} className={fence[1] ? `language-${fence[1]}` : undefined}>
          <code>{code.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const HeadingTag = `h${heading[1].length + 2}` as 'h3' | 'h4' | 'h5';
      blocks.push(<HeadingTag key={`h-${index++}`}>{parseInline(heading[2])}</HeadingTag>);
      continue;
    }

    const listItem = trimmed.match(/^(?:[-*+] |\d+\.\s+)(.+)$/);
    if (listItem) {
      flushParagraph();
      const ordered = /^\d+\.\s+/.test(trimmed);
      const items = [listItem[1]];
      while (i + 1 < lines.length) {
        const next = lines[i + 1].trim();
        const nextMatch = next.match(/^(?:[-*+] |\d+\.\s+)(.+)$/);
        if (!nextMatch || /^\d+\.\s+/.test(next) !== ordered) break;
        items.push(nextMatch[1]);
        i += 1;
      }
      const ListTag = ordered ? 'ol' : 'ul';
      blocks.push(
        <ListTag key={`list-${index++}`}>
          {items.map((item, itemIndex) => <li key={itemIndex}>{parseInline(item)}</li>)}
        </ListTag>,
      );
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  return blocks;
}

function ThinkingDisclosure({ content, complete }: { content: string; complete: boolean }) {
  return (
    <details className="thinking-disclosure">
      <summary>
        <span>{complete ? 'Show reasoning' : 'Reasoning in progress'}</span>
      </summary>
      <div className="thinking-disclosure-content">
        {renderMarkdownContent(content)}
      </div>
    </details>
  );
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  const segments = splitThinkingSegments(content);

  return (
    <div className="markdown-content">
      {segments.map((segment, index) => {
        if (segment.type === 'thinking') {
          return <ThinkingDisclosure key={`thinking-${index}`} content={segment.content} complete={segment.complete} />;
        }

        return <div key={`markdown-${index}`}>{renderMarkdownContent(segment.content)}</div>;
      })}
    </div>
  );
}
