import React, { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { oneDark } from "@codemirror/theme-one-dark";

interface CodeEditorProps {
  code: string;
  filename: string;
}

export function CodeEditor({ code, filename }: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  
  useEffect(() => {
    if (!editorRef.current) return;
    
    // Clean up previous editor instance
    if (viewRef.current) {
      viewRef.current.destroy();
    }
    
    // Determine language based on file extension
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    let lang = javascript();
    
    if (extension === 'html' || extension === 'htm') {
      lang = html();
    } else if (extension === 'css') {
      lang = css();
    }
    
    // Create editor state
    const state = EditorState.create({
      doc: code,
      extensions: [
        basicSetup,
        lang,
        oneDark,
        EditorView.editable.of(false), // Read-only mode
        EditorView.lineWrapping,
      ],
    });
    
    // Create editor view
    const view = new EditorView({
      state,
      parent: editorRef.current,
    });
    
    viewRef.current = view;
    
    return () => {
      view.destroy();
    };
  }, [code, filename]);
  
  return <div ref={editorRef} className="w-full h-full text-xs md:text-sm" />;
}
