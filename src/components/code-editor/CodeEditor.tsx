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
    let lang;
    
    if (extension === 'html' || extension === 'htm') {
      lang = html();
    } else if (extension === 'css') {
      lang = css();
    } else if (extension === 'tsx') {
      // TypeScript with JSX support
      lang = javascript({ typescript: true, jsx: true });
    } else if (extension === 'jsx') {
      // JavaScript with JSX support
      lang = javascript({ jsx: true });
    } else if (extension === 'ts') {
      // TypeScript support
      // Check if the content likely contains JSX
      const containsJSX = code.includes('React') || 
                          code.includes('jsx') || 
                          code.includes('</>') || 
                          /\<[A-Z][A-Za-z]*/.test(code); // Matches React component tags
      
      lang = javascript({ typescript: true, jsx: containsJSX });
    } else if (extension === 'js') {
      // Check if the content likely contains JSX (React components)
      const containsJSX = code.includes('React') || 
                          code.includes('jsx') || 
                          code.includes('</>') || 
                          /\<[A-Z][A-Za-z]*/.test(code); // Matches React component tags
      
      lang = javascript({ jsx: containsJSX });
    } else {
      // Default to JavaScript
      lang = javascript();
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
