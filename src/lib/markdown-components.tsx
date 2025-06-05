import type React from "react";

// Custom components for ReactMarkdown with enhanced styling
export const markdownComponents = {
  a: ({ ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="text-pink-400 hover:text-pink-300 underline decoration-pink-400/30 hover:decoration-pink-300 transition-colors"
    />
  ),
  h1: ({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 {...props} className="text-4xl font-bold text-white mb-6 mt-10 first:mt-0 leading-tight" />
  ),
  h2: ({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      {...props}
      className="text-3xl font-bold text-white mb-5 mt-10 border-b-2 border-slate-700 pb-3 leading-tight"
    />
  ),
  h3: ({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 {...props} className="text-2xl font-semibold text-white mb-4 mt-8 leading-tight" />
  ),
  p: ({ ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props} className="text-slate-200 leading-[1.8] mb-5 text-lg tracking-wide" />
  ),
  ul: ({ ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul {...props} className="text-slate-200 mb-5 ml-6 space-y-3 list-disc marker:text-pink-400" />
  ),
  ol: ({ ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol
      {...props}
      className="text-slate-200 mb-5 ml-6 space-y-3 list-decimal marker:text-pink-400"
    />
  ),
  li: ({ ...props }: React.HTMLAttributes<HTMLLIElement>) => (
    <li {...props} className="text-slate-200 leading-[1.8] text-lg pl-2" />
  ),
  blockquote: ({ ...props }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      {...props}
      className="border-l-4 border-pink-400 pl-6 italic text-slate-300 my-8 text-xl leading-relaxed"
    />
  ),
  strong: ({ ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong {...props} className="font-bold text-white" />
  ),
  em: ({ ...props }: React.HTMLAttributes<HTMLElement>) => (
    <em {...props} className="italic text-slate-200" />
  ),
  code: ({ ...props }: React.HTMLAttributes<HTMLElement>) => (
    <code
      {...props}
      className="bg-slate-900/80 px-2 py-1 rounded text-pink-300 font-mono text-sm"
    />
  ),
};
