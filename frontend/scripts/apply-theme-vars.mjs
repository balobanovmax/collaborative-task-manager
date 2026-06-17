import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '../src');

const replacements = [
  ['#FFFFFF', 'var(--bg-surface)'],
  ['#ffffff', 'var(--bg-surface)'],
  ['#F5F5F5', 'var(--bg-page)'],
  ['#f5f5f5', 'var(--bg-page)'],
  ['#fafafa', 'var(--bg-surface-alt)'],
  ['#f8f9fa', 'var(--bg-hover)'],
  ['#eeeeee', 'var(--bg-hover-alt)'],
  ['#eee', 'var(--bg-hover-alt)'],
  ['#f0f0f0', 'var(--bg-input-disabled)'],
  ['#E8F4FD', 'var(--bg-highlight)'],
  ['#e8f4fd', 'var(--bg-highlight)'],
  ['#333333', 'var(--text-primary)'],
  ['#333', 'var(--text-primary)'],
  ['#555555', 'var(--text-secondary)'],
  ['#7f8c8d', 'var(--text-muted)'],
  ['#666666', 'var(--text-subtle)'],
  ['#666', 'var(--text-subtle)'],
  ['#888', 'var(--text-faint)'],
  ['#999999', 'var(--text-placeholder)'],
  ['#999', 'var(--text-placeholder)'],
  ['#E0E0E0', 'var(--border)'],
  ['#e0e0e0', 'var(--border)'],
  ['#ddd', 'var(--border-light)'],
  ['#4A90E2', 'var(--primary)'],
  ['#4a90e2', 'var(--primary)'],
  ['#357ABD', 'var(--primary-hover)'],
  ['#357abd', 'var(--primary-hover)'],
  ['#6C757D', 'var(--secondary-text)'],
  ['#6c757d', 'var(--secondary-text)'],
  ['#5a6268', 'var(--secondary-muted-hover)'],
  ['#E74C3C', 'var(--danger)'],
  ['#e74c3c', 'var(--danger)'],
  ['#C0392B', 'var(--danger-hover)'],
  ['#c0392b', 'var(--danger-hover)'],
  ['#FFEBEE', 'var(--danger-bg)'],
  ['#ffebee', 'var(--danger-bg)'],
  ['#ffcdd2', 'var(--danger-border)'],
  ['#dc3545', 'var(--danger-alt)'],
  ['#c82333', 'var(--danger-alt-hover)'],
  ['#5CB85C', 'var(--success)'],
  ['#5cb85c', 'var(--success)'],
  ['#4CAE4C', 'var(--success-hover)'],
  ['#4cae4c', 'var(--success-hover)'],
  ['#2E7D32', 'var(--success-text)'],
  ['#2e7d32', 'var(--success-text)'],
  ['#E8F5E9', 'var(--success-bg)'],
  ['#e8f5e9', 'var(--success-bg)'],
  ['#155724', 'var(--success-dark-text)'],
  ['#D4EDDA', 'var(--success-dark-bg)'],
  ['#d4edda', 'var(--success-dark-bg)'],
  ['#27AE60', 'var(--success-accent)'],
  ['#27ae60', 'var(--success-accent)'],
  ['#FFF3CD', 'var(--warning-bg)'],
  ['#fff3cd', 'var(--warning-bg)'],
  ['#856404', 'var(--warning-text)'],
  ['#E3F2FD', 'var(--badge-owner-bg)'],
  ['#e3f2fd', 'var(--badge-owner-bg)'],
  ['#e8e8e8', 'var(--chat-bubble)'],
  ['#ccc', 'var(--bg-disabled)'],
  ['rgba(0, 0, 0, 0.5)', 'var(--overlay-heavy)'],
  ['rgba(0, 0, 0, 0.4)', 'var(--overlay)'],
  ['rgba(0, 0, 0, 0.3)', 'var(--overlay-light)'],
  ['rgba(0, 0, 0, 0.2)', 'var(--shadow-md)'],
  ['rgba(0, 0, 0, 0.15)', 'var(--shadow)'],
  ['rgba(0, 0, 0, 0.1)', 'var(--shadow-sm)'],
  ['rgba(255, 255, 255, 0.7)', 'var(--chat-time-own)'],
];

const whitePatterns = [
  [/background-color:\s*white/g, 'background-color: var(--bg-surface)'],
  [/background:\s*white/g, 'background: var(--bg-surface)'],
  [/color:\s*white/g, 'color: var(--text-inverse)'],
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.name.endsWith('.module.css')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      for (const [from, to] of replacements) {
        content = content.split(from).join(to);
      }
      for (const [pattern, replacement] of whitePatterns) {
        content = content.replace(pattern, replacement);
      }
      fs.writeFileSync(fullPath, content);
    }
  }
}

walk(srcDir);
console.log('Theme variables applied to CSS modules.');
