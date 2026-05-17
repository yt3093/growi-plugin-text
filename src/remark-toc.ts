import GithubSlugger from 'github-slugger';
import { toString } from 'mdast-util-to-string';
import type { Heading, Link, List, ListItem, Paragraph, Root, Text } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

const TOC_PATTERN = /^\[TOC(?:\s+level=(\d+))?\]$/i;

type HeadingEntry = {
  depth: number;
  text: string;
  slug: string;
};

function collectHeadings(tree: Root): HeadingEntry[] {
  const slugger = new GithubSlugger();
  const headings: HeadingEntry[] = [];

  visit(tree, 'heading', (node: Heading) => {
    const text = toString(node);
    const slug = slugger.slug(text);
    headings.push({ depth: node.depth, text, slug });
  });

  return headings;
}

function buildListItem(entry: HeadingEntry): ListItem {
  const link: Link = {
    type: 'link',
    url: `#${entry.slug}`,
    children: [{ type: 'text', value: entry.text } as Text],
  };
  return {
    type: 'listItem',
    spread: false,
    children: [{ type: 'paragraph', children: [link] } as Paragraph],
  };
}

function buildTocList(headings: HeadingEntry[], maxDepth: number): List {
  const filtered = headings.filter(h => h.depth <= maxDepth);

  const list: List = {
    type: 'list',
    ordered: false,
    spread: false,
    children: filtered.map(buildListItem),
    data: {
      hProperties: { className: ['growi-plugin-text-toc'] },
    },
  };

  return list;
}

export const remarkToc: Plugin<[], Root> = () => (tree) => {
  const headings = collectHeadings(tree);

  visit(tree, 'paragraph', (node: Paragraph, index, parent) => {
    if (parent == null || index == null) return;
    if (node.children.length !== 1 || node.children[0].type !== 'text') return;

    const textNode = node.children[0] as Text;
    const match = TOC_PATTERN.exec(textNode.value.trim());
    if (match == null) return;

    const maxDepth = match[1] != null ? parseInt(match[1], 10) : 6;

    if (headings.length === 0) return;

    (parent.children as Root['children'])[index] = buildTocList(headings, maxDepth);
  });
};
