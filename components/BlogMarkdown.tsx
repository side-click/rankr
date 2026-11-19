"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface BlogMarkdownProps {
  content: string;
}

export function BlogMarkdown({ content }: BlogMarkdownProps) {
  if (!content.trim()) {
    return (
      <p className="text-sm italic text-[#a6a89e]">No content yet.</p>
    );
  }

  return (
    <div className="blog-markdown space-y-4 text-[#e8e5d8] text-[15px] leading-relaxed break-words [overflow-wrap:anywhere]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="wow-heading text-2xl sm:text-3xl font-bold text-[#f0c020] pt-3 pb-1.5 border-b border-[#c89b3c]/35">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="wow-heading text-xl sm:text-2xl font-bold text-[#f0c020] pt-3 pb-1 border-b border-white/10">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-extrabold text-[#f0ede0] pt-2">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-bold text-[#d4d2c5] pt-1">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-[15px] leading-7 text-[#e4e1d4]">{children}</p>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#f0c020] underline decoration-[#f0c020]/50 hover:decoration-[#f0c020] hover:text-[#ffe57f] transition-colors"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-extrabold text-[#f8f6ee]">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-[#d8d5c8]">{children}</em>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#c89b3c] bg-black/25 px-4 py-2.5 rounded-r text-[#d4d2c5] italic space-y-2">
              {children}
            </blockquote>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-6 space-y-1.5 text-[#e4e1d4]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 space-y-1.5 text-[#e4e1d4]">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          hr: () => <hr className="border-t border-[#c89b3c]/30 my-5" />,
          code: ({ className, children }) => {
            const isBlock = Boolean(className);
            if (isBlock) {
              return (
                <code className="block bg-black/45 border border-white/10 rounded p-3 text-xs font-mono text-[#f0ede0] overflow-x-auto">
                  {children}
                </code>
              );
            }
            return (
              <code className="bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-[13px] font-mono text-[#ffe57f]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto">{children}</pre>
          ),
          img: ({ src, alt }) => {
            if (!src || typeof src !== "string") return null;
            return (
              <figure className="my-4">
                <img
                  src={src}
                  alt={alt ?? "Blog image"}
                  className="max-w-full max-h-[540px] mx-auto rounded-lg border border-white/15 bg-black/30 object-contain shadow-lg"
                />
                {alt && alt !== "image" && alt !== "Blog image" && (
                  <figcaption className="text-center text-xs text-[#a6a89e] mt-1.5">
                    {alt}
                  </figcaption>
                )}
              </figure>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full text-xs border-collapse border border-white/15">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-black/40 border border-white/15 px-2.5 py-1.5 text-left font-bold text-[#f0c020]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-white/15 px-2.5 py-1.5 text-[#e4e1d4]">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
