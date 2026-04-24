'use client';

import React, { useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { Copy } from 'lucide-react';

interface Props {
  content: string;
  onNavigate?: (path: string) => void;
}

export default function MarkdownViewer({ content, onNavigate }: Props) {
  // Pre-process: convert wikilinks [[target|label]] → markdown links
  // and callouts > [!type] → styled divs
  const processed = useMemo(() => processContent(content), [content]);

  const copyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
  }, []);

  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={{
          // Headings with anchor IDs
          h1: ({ children, ...props }) => {
            const text = extractText(children);
            const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
            return <h1 id={id} {...props}>{children}</h1>;
          },
          h2: ({ children, ...props }) => {
            const text = extractText(children);
            const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
            return <h2 id={id} {...props}>{children}</h2>;
          },
          h3: ({ children, ...props }) => {
            const text = extractText(children);
            const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
            return <h3 id={id} {...props}>{children}</h3>;
          },
          h4: ({ children, ...props }) => {
            const text = extractText(children);
            const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
            return <h4 id={id} {...props}>{children}</h4>;
          },
          h5: ({ children, ...props }) => {
            const text = extractText(children);
            const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
            return <h5 id={id} {...props}>{children}</h5>;
          },
          h6: ({ children, ...props }) => {
            const text = extractText(children);
            const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
            return <h6 id={id} {...props}>{children}</h6>;
          },
          // Code blocks with copy button
          pre: ({ children, ...props }) => {
            const codeEl = React.Children.toArray(children).find(
              (child): child is React.ReactElement => React.isValidElement(child) && (child as React.ReactElement<{ className?: string }>).type === 'code'
            );
            const codeText = codeEl ? extractText((codeEl.props as { children?: React.ReactNode }).children) : '';
            return (
              <pre {...props}>
                <button
                  className="copy-btn"
                  onClick={() => copyCode(codeText)}
                >Copier</button>
                {children}
              </pre>
            );
          },
          // Links: handle wikilinks and internal navigation
          a: ({ href, children, ...props }) => {
            if (href?.startsWith('obsidian-nav://')) {
              const path = decodeURIComponent(href.replace('obsidian-nav://', ''));
              return (
                <a
                  className="wikilink"
                  onClick={e => { e.preventDefault(); onNavigate?.(path.endsWith('.md') ? path : path + '.md'); }}
                  href="#"
                  {...props}
                >
                  {children}
                </a>
              );
            }
            return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
          },
          // Images: clickable
          img: ({ src, alt, ...props }) => (
            <img src={src} alt={alt || ''} title={alt || ''} loading="lazy" {...props} />
          ),
          // Task list checkboxes
          input: ({ type, checked, ...props }) => {
            if (type === 'checkbox') {
              return <input type="checkbox" checked={checked} readOnly {...props} />;
            }
            return <input type={type} {...props} />;
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}

// ─── Content Processing ─────────────────────────────────

function processContent(raw: string): string {
  let content = raw;

  // Remove frontmatter
  content = content.replace(/^---\n[\s\S]*?\n---\n?/m, (match) => {
    return parseFrontmatter(match);
  });

  // Convert [[wikilinks]] to custom navigable links
  content = content.replace(/\[\[([^\]]+)\]\]/g, (_, link) => {
    const parts = link.split('|');
    const target = parts[0].trim();
    const label = parts.length > 1 ? parts[1].trim() : target;
    return `[${label}](obsidian-nav://${encodeURIComponent(target)})`;
  });

  // Convert callouts > [!type] title...
  content = content.replace(/^> \[!([\w-]+)\]([-+])?\s*(.*?)$\n((?:^>.*$\n?)*)/gm, (_, type, fold, title, body) => {
    const typeLC = type.toLowerCase();
    const bodyText = body.replace(/^> ?/gm, '').trim();
    const cssClass = `callout callout-${typeLC}`;
    const icon = getCalloutIcon(typeLC);
    return `<div class="${cssClass}"><div class="callout-title">${icon} ${title || type}</div><div>${bodyText}</div></div>\n`;
  });

  // Convert ==highlights== to <mark>
  content = content.replace(/==(.*?)==/g, '<mark>$1</mark>');

  return content;
}

function parseFrontmatter(raw: string): string {
  const inner = raw.replace(/^---\n?/, '').replace(/\n?---\n?$/, '').trim();
  if (!inner) return '';
  const lines = inner.split('\n').map(l => {
    const idx = l.indexOf(':');
    if (idx === -1) return `<span>${l}</span>`;
    const key = l.substring(0, idx).trim();
    const val = l.substring(idx + 1).trim();
    return `<span class="fm-key">${key}</span>: <span class="fm-val">${val}</span>`;
  });
  return `<div class="frontmatter-block">${lines.join('<br/>')}</div>\n\n`;
}

function getCalloutIcon(type: string): string {
  const icons: Record<string, string> = {
    note: '📝', info: 'ℹ️', tip: '💡', warning: '⚠️', caution: '🔴', danger: '🔴',
    important: '❗', example: '📋', quote: '💬', abstract: '📄', summary: '📖',
    todo: '☑️', success: '✅', question: '❓', failure: '❌', bug: '🐛',
  };
  return icons[type] || '📝';
}

function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (React.isValidElement(children)) return extractText((children.props as { children?: React.ReactNode }).children);
  return '';
}
