'use client';

import React, { useMemo, useCallback } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import Image from 'next/image';

interface Props {
  content: string;
  notePath?: string;
  onNavigate?: (path: string) => void;
}

export default function MarkdownViewer({ content, notePath, onNavigate }: Props) {
  // Pre-process: convert wikilinks [[target|label]] → markdown links
  // and callouts > [!type] → styled divs
  const processed = useMemo(() => processContent(content), [content]);

  const copyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
  }, []);

  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkCallouts]}
        rehypePlugins={[rehypeKatex]}
        urlTransform={url => url.startsWith('shardnote-nav://') ? url : defaultUrlTransform(url)}
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
            if (href?.startsWith('shardnote-nav://')) {
              const path = decodeURIComponent(href.replace('shardnote-nav://', ''));
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
          // Remote images are blocked by default to avoid leaking client metadata.
          img: ({ src, alt }) => {
            const value = typeof src === 'string' ? src : '';
            if (/^(?:https?:)?\/\//i.test(value)) {
              return <span className="external-image-blocked">Image distante bloquée · {alt || value}</span>;
            }
            const resolved = resolveAttachmentPath(notePath, value);
            if (!resolved) return <span className="external-image-blocked">Chemin de pièce jointe refusé · {alt || value}</span>;
            return <Image src={`/api/vault/asset?path=${encodeURIComponent(resolved)}`} alt={alt || ''} width={1200} height={800} unoptimized />;
          },
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
  let content = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  // Convert [[wikilinks]] to custom navigable links
  content = content.replace(/\[\[([^\]]+)\]\]/g, (_, link) => {
    const parts = link.split('|');
    const target = parts[0].trim();
    const label = parts.length > 1 ? parts[1].trim() : target;
    return `[${label}](shardnote-nav://${encodeURIComponent(target)})`;
  });
  return content;
}

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}

function remarkCallouts() {
  return (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode) => {
      if (node.type === 'blockquote') {
        const firstText = node.children?.[0]?.children?.[0];
        const match = firstText?.value?.match(/^\[!([\w-]+)\][-+]?\s*(.*)$/i);
        if (match && firstText) {
          const type = match[1].toLowerCase();
          firstText.value = match[2] || match[1];
          node.data = {
            hName: 'div',
            hProperties: { className: `callout callout-${type}` },
          };
        }
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

function resolveAttachmentPath(notePath: string | undefined, assetPath: string): string | null {
  if (!assetPath || assetPath.startsWith('/') || /^[a-zA-Z]:/.test(assetPath)) return null;
  const base = notePath?.split('/').slice(0, -1) ?? [];
  const segments = [...base, ...assetPath.replace(/\\/g, '/').split('/')];
  const normalized: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (!normalized.length) return null;
      normalized.pop();
    } else {
      normalized.push(segment);
    }
  }
  return normalized.join('/');
}

function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (React.isValidElement(children)) return extractText((children.props as { children?: React.ReactNode }).children);
  return '';
}
