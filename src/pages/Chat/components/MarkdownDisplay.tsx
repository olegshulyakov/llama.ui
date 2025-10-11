import 'katex/dist/katex.min.css';
import { all as languages } from 'lowlight';
import React, { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Markdown, { ExtraProps } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { Button, Icon } from '../../../components';
import { useAppContext } from '../../../store/app';
import { useChatContext } from '../../../store/chat';
import { CanvasType } from '../../../types';
import { copyStr } from '../../../utils';
import MermaidChart from './MermaidChart';

export default memo(function MarkdownDisplay({ content }: { content: string }) {
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
          <CustomPre {...props} origContent={preprocessedContent} />
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
    ExtraProps & { origContent: string }
> = ({ className, children, node, origContent }) => {
  const { t } = useTranslation();

  const { language, code } = useMemo(() => {
    const startOffset = node?.position?.start.offset;
    const endOffset = node?.position?.end.offset;
    if (!startOffset || !endOffset) {
      return {
        language: '',
        code: '',
      };
    }
    return {
      language:
        origContent
          .substring(startOffset, endOffset)
          .match(/^```([^\n]+)\n/)?.[1] ?? '',
      code: getCodeContent(origContent.substring(startOffset, endOffset)),
    };
  }, [node?.position, origContent]);

  if (!!language && !!code && language.toLowerCase() === 'mermaid') {
    return <MermaidChart className="mermaid-diagram" code={code} />;
  }

  return (
    <div className="hljs" aria-label={t('chatScreen.ariaLabels.codeBlock')}>
      <CodeBlockToolbar language={language} code={code} />

      <pre className={className} {...node?.properties}>
        <CodeLanguageDisplay language={language} />
        {children}
      </pre>
    </div>
  );
};

function CodeBlockToolbar({
  language,
  code,
}: {
  language: string;
  code: string;
}) {
  const { t } = useTranslation();
  const {
    config: { pyIntepreterEnabled },
  } = useAppContext();
  const { setCanvasData } = useChatContext();

  const canRunCode = useMemo(
    () => pyIntepreterEnabled && language.toLowerCase() === 'python',
    [pyIntepreterEnabled, language]
  );

  const handleCopy = useCallback(() => {
    if (!code) return;
    copyStr(code);
  }, [code]);

  const handleRun = useCallback(() => {
    if (!code) return;

    if (language.toLowerCase() === 'python') {
      setCanvasData({
        type: CanvasType.PY_INTERPRETER,
        content: code,
      });
    }
  }, [code, language, setCanvasData]);

  if (!language || !code) return null;

  return (
    <div className="hljs sticky h-0 z-[1] text-right p-0">
      {canRunCode && (
        <Button
          variant="ghost"
          size="icon"
          title={t('chatScreen.titles.run')}
          aria-label={t('chatScreen.ariaLabels.runCode')}
          onClick={handleRun}
        >
          <Icon icon="LuPlay" size="sm" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        title={t('chatScreen.titles.copy')}
        aria-label={t('chatScreen.ariaLabels.copyContent')}
        onClick={handleCopy}
      >
        <Icon icon="LuCopy" size="sm" />
      </Button>
    </div>
  );
}

function CodeLanguageDisplay({ language }: { language: string }) {
  const { t } = useTranslation();
  if (!language) return null;

  return (
    <div
      className="text-sm ml-2"
      aria-label={t('chatScreen.ariaLabels.codeLanguage')}
    >
      {language}
    </div>
  );
}

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
