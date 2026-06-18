import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ChatMessage({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium text-blue-600 hover:text-blue-800 break-all"
          >
            {children}
          </a>
        ),
        p: ({ children }) => <p className="my-1">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
        ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
        li: ({ children }) => <li className="my-0.5">{children}</li>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
