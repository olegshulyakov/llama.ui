import { DocumentDuplicateIcon, PlayIcon } from '@heroicons/react/24/outline';
import 'katex/dist/katex.min.css';
import { all as languages } from 'lowlight';
import React, { memo, useMemo, useState } from 'react';
import Markdown, { ExtraProps } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { useAppContext } from '../context/app';
import { useChatContext } from '../context/chat';
import { CanvasType } from '../types';
import { classNames, copyStr } from '../utils';

export default memo(function MarkdownDisplay({
  content,
  isGenerating,
}: {
  content: string;
  isGenerating?: boolean;
}) {
  const preprocessedContent = useMemo(
    () => preprocessLaTeX(content),
    [content]
  );
  return (
    <Markdown
      remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
      rehypePlugins={[[rehypeHighlight, { languages }], rehypeKatex]}
      components={{
        table: (props) => <CustomTable {...props} />,
        pre: (props) => (
          <CustomPre
            {...props}
            isGenerating={isGenerating}
            origContent={preprocessedContent}
          />
        ),
        // note: do not use "pre", "p" or other basic html elements here, it will cause the node to re-render when the message is being generated (this should be a bug with react-markdown, not sure how to fix it)
      }}
    >
      {preprocessedContent}
    </Markdown>
  );
});

const CustomTable: React.ElementType<
  React.ClassAttributes<HTMLTableElement> &
    React.HTMLAttributes<HTMLTableElement> &
    ExtraProps
> = ({ className, children, node }) => (
  <div className="overflow-x-auto">
    <table className={className} {...node?.properties}>
      {children}
    </table>
  </div>
);

const CustomPre: React.ElementType<
  React.ClassAttributes<HTMLPreElement> &
    React.HTMLAttributes<HTMLPreElement> &
    ExtraProps & { origContent: string; isGenerating?: boolean }
> = ({ className, children, node, origContent, isGenerating }) => {
  const {
    config: { pyIntepreterEnabled },
  } = useAppContext();
  const { setCanvasData } = useChatContext();

  const showActionButtons = useMemo(() => {
    const startOffset = node?.position?.start.offset;
    const endOffset = node?.position?.end.offset;
    if (!startOffset || !endOffset) return false;
    return true;
  }, [node?.position]);

  const codeLanguage = useMemo(() => {
    const startOffset = node?.position?.start.offset;
    const endOffset = node?.position?.end.offset;
    if (!startOffset || !endOffset) return '';

    return (
      origContent
        .substring(startOffset, endOffset)
        .match(/^```([^\n]+)\n/)?.[1] ?? ''
    );
  }, [node?.position, origContent]);

  const canRunCode = useMemo(
    () =>
      !isGenerating &&
      pyIntepreterEnabled &&
      codeLanguage.toLowerCase() === 'python',
    [isGenerating, pyIntepreterEnabled, codeLanguage]
  );

  const handleCopy = () => {
    const startOffset = node?.position?.start.offset;
    const endOffset = node?.position?.end.offset;
    if (!startOffset || !endOffset) return;

    copyStr(getCodeContent(origContent.substring(startOffset, endOffset)));
  };
  const handleRun = () => {
    const startOffset = node?.position?.start.offset;
    const endOffset = node?.position?.end.offset;
    if (!startOffset || !endOffset) return;

    setCanvasData({
      type: CanvasType.PY_INTERPRETER,
      content: getCodeContent(origContent.substring(startOffset, endOffset)),
    });
  };

  return (
    <div className="hljs" aria-label="Code block">
      {showActionButtons && (
        <div
          className={classNames({
            'hljs sticky h-0 z-[1] text-right p-0': true,
            'display-none': !node?.position,
          })}
          aria-label="Button block"
        >
          {canRunCode && (
            <RunCodeButton
              className="btn btn-ghost w-8 h-8 p-0"
              onRun={handleRun}
            />
          )}
          <CopyButton
            className="btn btn-ghost w-8 h-8 p-0"
            onCopy={handleCopy}
          />
        </div>
      )}

      <pre className={className} {...node?.properties}>
        {codeLanguage && (
          <div className="text-sm ml-2" aria-label="Code language">
            {codeLanguage}
          </div>
        )}

        {children}
      </pre>
    </div>
  );
};

export const CopyButton = ({
  className,
  onCopy,
}: {
  className?: string;
  onCopy: () => void;
}) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={className}
      onClick={() => {
        onCopy();
        setCopied(true);
      }}
      onMouseLeave={() => setCopied(false)}
      title={copied ? 'Copied!' : 'Copy'}
      aria-label={copied ? 'Content copied' : 'Copy content'}
    >
      <DocumentDuplicateIcon className="h-4 w-4" />
    </button>
  );
};

export const RunCodeButton = ({
  className,
  onRun,
}: {
  className?: string;
  onRun: () => void;
}) => {
  return (
    <button
      className={className}
      onClick={onRun}
      title="Run code"
      aria-label="Run the code"
    >
      <PlayIcon className="h-4 w-4" />
    </button>
  );
};

/**
 * The part below is copied and adapted from:
 * https://github.com/danny-avila/LibreChat/blob/main/client/src/utils/latex.ts
 * (MIT License)
 */

// Regex to check if the processed content contains any potential LaTeX patterns
const containsLatexRegex =
  /\\\(.*?\\\)|\\\[.*?\\\]|\$.*?\$|\\begin\{equation\}.*?\\end\{equation\}/;

// Regex for inline and block LaTeX expressions
const inlineLatex = new RegExp(/\\\((.+?)\\\)/, 'g');
const blockLatex = new RegExp(/\\\[(.*?[^\\])\\\]/, 'gs');

// Function to restore code blocks
const restoreCodeBlocks = (content: string, codeBlocks: string[]) => {
  return content.replace(
    /<<CODE_BLOCK_(\d+)>>/g,
    (_, index) => codeBlocks[index]
  );
};

// Regex to identify code blocks and inline code
const codeBlockRegex = /(```[\s\S]*?```|`.*?`)/g;

export const processLaTeX = (_content: string) => {
  let content = _content;
  // Temporarily replace code blocks and inline code with placeholders
  const codeBlocks: string[] = [];
  let index = 0;
  content = content.replace(codeBlockRegex, (match) => {
    codeBlocks[index] = match;
    return `<<CODE_BLOCK_${index++}>>`;
  });

  // Escape dollar signs followed by a digit or space and digit
  let processedContent = content.replace(/(\$)(?=\s?\d)/g, '\\$');

  // If no LaTeX patterns are found, restore code blocks and return the processed content
  if (!containsLatexRegex.test(processedContent)) {
    return restoreCodeBlocks(processedContent, codeBlocks);
  }

  // Convert LaTeX expressions to a markdown compatible format
  processedContent = processedContent
    .replace(inlineLatex, (_: string, equation: string) => `$${equation}$`) // Convert inline LaTeX
    .replace(blockLatex, (_: string, equation: string) => `$$${equation}$$`); // Convert block LaTeX

  // Restore code blocks
  return restoreCodeBlocks(processedContent, codeBlocks);
};

/**
 * Preprocesses LaTeX content by replacing delimiters and escaping certain characters.
 *
 * @param content The input string containing LaTeX expressions.
 * @returns The processed string with replaced delimiters and escaped characters.
 */
export function preprocessLaTeX(content: string): string {
  // Step 1: Protect code blocks
  const codeBlocks: string[] = [];
  content = content.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (_, code) => {
    codeBlocks.push(code);
    return `<<CODE_BLOCK_${codeBlocks.length - 1}>>`;
  });

  // Step 2: Protect existing LaTeX expressions
  const latexExpressions: string[] = [];

  // Protect block math ($$...$$), \[...\], and \(...\) as before.
  content = content.replace(
    /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\))/g,
    (match) => {
      latexExpressions.push(match);
      return `<<LATEX_${latexExpressions.length - 1}>>`;
    }
  );

  // Protect inline math ($...$) only if it does NOT match a currency pattern.
  // We assume a currency pattern is one where the inner content is purely numeric (with optional decimals).
  content = content.replace(/\$([^$]+)\$/g, (match, inner) => {
    if (/^\s*\d+(?:\.\d+)?\s*$/.test(inner)) {
      // This looks like a currency value (e.g. "$123" or "$12.34"),
      // so don't protect it.
      return match;
    } else {
      // Otherwise, treat it as a LaTeX expression.
      latexExpressions.push(match);
      return `<<LATEX_${latexExpressions.length - 1}>>`;
    }
  });

  // Step 3: Escape dollar signs that are likely currency indicators.
  // (Now that inline math is protected, this will only escape dollars not already protected)
  content = content.replace(/\$(?=\d)/g, '\\$');

  // Step 4: Restore LaTeX expressions
  content = content.replace(
    /<<LATEX_(\d+)>>/g,
    (_, index) => latexExpressions[parseInt(index)]
  );

  // Step 5: Restore code blocks
  content = content.replace(
    /<<CODE_BLOCK_(\d+)>>/g,
    (_, index) => codeBlocks[parseInt(index)]
  );

  // Step 6: Apply additional escaping functions
  content = escapeBrackets(content);
  content = escapeMhchem(content);

  return content;
}

export function escapeBrackets(text: string): string {
  const pattern =
    /(```[\S\s]*?```|`.*?`)|\\\[([\S\s]*?[^\\])\\]|\\\((.*?)\\\)/g;
  return text.replace(
    pattern,
    (
      match: string,
      codeBlock: string | undefined,
      squareBracket: string | undefined,
      roundBracket: string | undefined
    ): string => {
      if (codeBlock != null) {
        return codeBlock;
      } else if (squareBracket != null) {
        return `$$${squareBracket}$$`;
      } else if (roundBracket != null) {
        return `$${roundBracket}$`;
      }
      return match;
    }
  );
}

export function escapeMhchem(text: string) {
  return text.replaceAll('$\\ce{', '$\\\\ce{').replaceAll('$\\pu{', '$\\\\pu{');
}

function getCodeContent(content: string) {
  return content.replace(/^```[^\n]+\n/g, '').replace(/```$/g, '');
}
