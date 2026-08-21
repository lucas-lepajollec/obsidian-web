'use client';

import React, { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState } from '@codemirror/state';
import { keymap } from '@codemirror/view';

interface Props {
  content: string;
  onChange: (value: string) => void;
  onSave?: () => void;
}

export default function MarkdownEditor({ content, onChange, onSave }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onChangeRef.current = onChange;
    onSaveRef.current = onSave;
  }, [onChange, onSave]);

  useEffect(() => {
    if (!parentRef.current) return;

    // Clean up previous view
    if (viewRef.current) {
      viewRef.current.destroy();
    }

    const saveKeymap = keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          onSaveRef.current?.();
          return true;
        },
      },
    ]);

    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        markdown(),
        oneDark,
        saveKeymap,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: 'inherit' },
          '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
          '.cm-content': { padding: '24px 0' },
          '.cm-gutters': { background: '#181818', border: 'none' },
          '.cm-activeLineGutter': { background: '#222' },
          '.cm-activeLine': { background: 'rgba(79,140,255,0.07)' },
          '.cm-cursor': { borderLeftColor: '#7487b8' },
          '.cm-selectionBackground': { background: 'rgba(79,140,255,0.22) !important' },
        }),
      ],
    });

    viewRef.current = new EditorView({
      state,
      parent: parentRef.current,
    });

    return () => {
      viewRef.current?.destroy();
    };
    // Only re-create when content identity changes from outside (file switch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When content changes from outside (file switch), update the document
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    const view = viewRef.current;
    if (view) {
      const currentDoc = view.state.doc.toString();
      if (currentDoc !== content) {
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: content },
        });
      }
    }
  }, [content]);

  return (
    <div ref={parentRef} className="flex-1 h-full min-h-0 select-text" />
  );
}
