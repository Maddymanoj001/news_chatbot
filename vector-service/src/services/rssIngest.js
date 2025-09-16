import Parser from 'rss-parser';
import { config } from '../utils/config.js';

const parser = new Parser();

const FEEDS = [
  'https://rss.app/feeds/tTXf8ZeIjS4aIYxA.xml',
  'https://rss.app/feeds/tL2bwHyKEHnS7UOe.xml',
  'https://rss.app/feeds/tEV1F0RrLYfo7DmO.xml',
  'https://rss.app/feeds/tCFr3NlNYnFRx9sH.xml'
];

export async function fetchArticles(max = config.maxArticles) {
  const items = [];
  for (const url of FEEDS) {
    try {
      const feed = await parser.parseURL(url);
      for (const it of feed.items) {
        const text = [it.title, it.contentSnippet || it.content || '', it.link || ''].filter(Boolean).join('\n');
        items.push({
          id: it.guid || it.link || it.title,
          title: it.title,
          text,
          source: it.link || url
        });
        if (items.length >= max) break;
      }
      if (items.length >= max) break;
    } catch (e) {
      console.error('Failed to parse feed', url, e.message);
    }
  }
  return items.slice(0, max);
}
