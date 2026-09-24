import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import GithubSlugger from 'github-slugger';
import MarkdownIt, { type Token } from 'markdown-it';
import { ROOT, read, trackedFiles } from './repo-files';

interface MarkdownLink {
  url: string;
  line: number;
}

interface MarkdownHeading {
  depth: number;
  text: string;
}

export interface MarkdownDocument {
  tokens: readonly Token[];
  headings: readonly MarkdownHeading[];
  links: readonly MarkdownLink[];
  anchors: ReadonlySet<string>;
  /** The text of every inline code span, in order. */
  codeSpans: readonly string[];
  /** The text of every fenced or indented code block, in order. */
  codeBlocks: readonly string[];
}

const markdownIt = new MarkdownIt();

const TEXT_TOKENS = new Set(['text', 'code_inline']);

/** What GitHub slugs a heading from: its text with the markup gone, code spans kept. */
function plainText(inline: Token): string {
  return (inline.children ?? [])
    .filter((child) => TEXT_TOKENS.has(child.type))
    .map((child) => child.content)
    .join('');
}

/** `blockLine` is the line of the block around it: an inline token in a table cell carries none. */
function linksIn(inline: Token, blockLine: number): MarkdownLink[] {
  const firstLine = (inline.map?.[0] ?? blockLine) + 1;
  let breaks = 0;
  const links: MarkdownLink[] = [];
  for (const child of inline.children ?? []) {
    if (child.type === 'softbreak' || child.type === 'hardbreak') breaks += 1;
    const url = child.type === 'link_open' ? child.attrGet('href') : null;
    if (typeof url === 'string') links.push({ url, line: firstLine + breaks });
  }
  return links;
}

export function parseMarkdown(text: string): MarkdownDocument {
  const tokens = markdownIt.parse(text, {});
  const slugger = new GithubSlugger();
  const headings: MarkdownHeading[] = [];
  const links: MarkdownLink[] = [];
  const codeSpans: string[] = [];
  const codeBlocks: string[] = [];

  let blockLine = 0;
  for (const [index, token] of tokens.entries()) {
    blockLine = token.map?.[0] ?? blockLine;
    const inline = tokens[index + 1];
    if (token.type === 'heading_open' && inline) {
      headings.push({ depth: Number(token.tag.slice(1)), text: plainText(inline) });
    }
    if (token.type === 'fence' || token.type === 'code_block') codeBlocks.push(token.content);
    if (token.type === 'inline') {
      links.push(...linksIn(token, blockLine));
      for (const child of token.children ?? []) {
        if (child.type === 'code_inline') codeSpans.push(child.content);
      }
    }
  }

  const anchors = new Set(headings.map((heading) => slugger.slug(heading.text)));
  return { tokens, headings, links, anchors, codeSpans, codeBlocks };
}

const documents = new Map<string, MarkdownDocument>();

/** A tracked document, parsed once per process: the doc assertions read the same files. */
export function markdownDocument(file: string): MarkdownDocument {
  let document = documents.get(file);
  if (document === undefined) {
    document = parseMarkdown(read(file));
    documents.set(file, document);
  }
  return document;
}

/**
 * Every tracked `.md` outside `.agents/`. The `CLAUDE.md` files are symlinks to their `AGENTS.md`,
 * so reading them would check each document twice.
 */
export function trackedDocuments(): string[] {
  return trackedFiles(':(glob)**/*.md', ':(exclude).agents').filter(
    (file) => !lstatSync(join(ROOT, file)).isSymbolicLink()
  );
}
