import ReactMarkdown from "react-markdown";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";

  if (!message.content && !message.tool_calls?.length) return null;

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div className={cn("max-w-[80%]", isUser && "flex flex-col items-end")}>
        {message.content && (
          <div className={cn(
            "rounded-2xl px-4 py-2.5 text-sm",
            isUser
              ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
              : "bg-card border border-border text-foreground"
          )}>
            {isUser ? (
              <p className="leading-relaxed">{message.content}</p>
            ) : (
              <ReactMarkdown
                className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 leading-relaxed"
                components={{
                  p: ({ children }) => <p className="my-1">{children}</p>,
                  a: ({ children, ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        )}
      </div>
    </div>
  );
}