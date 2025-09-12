export function htmlToMarkdown(html: string): string {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // Simple server-side conversion (just strip HTML tags for now)
    return html.replace(/<[^>]*>/g, '').trim();
  }
  
  try {
    // Create a temporary div to parse HTML
    const div = document.createElement('div');
    div.innerHTML = html;
  
  let markdown = '';
  
  const processNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();
      let content = '';
      
      // Process children
      for (const child of Array.from(node.childNodes)) {
        content += processNode(child);
      }
      
      // Handle different HTML elements
      switch (tagName) {
        case 'strong':
        case 'b':
          return `**${content}**`;
        case 'em':
        case 'i':
          return `*${content}*`;
        case 'del':
        case 's':
        case 'strike':
          return `~~${content}~~`;
        case 'sup':
          return `^${content}`;
        case 'sub':
          return `~${content}`;
        case 'h1':
          return `# ${content}\n\n`;
        case 'h2':
          return `## ${content}\n\n`;
        case 'h3':
          return `### ${content}\n\n`;
        case 'h4':
          return `#### ${content}\n\n`;
        case 'h5':
          return `##### ${content}\n\n`;
        case 'h6':
          return `###### ${content}\n\n`;
        case 'p':
          return `${content}\n\n`;
        case 'br':
          return '\n';
        case 'a':
          const href = element.getAttribute('href');
          return `[${content}](${href})`;
        case 'img':
          const src = element.getAttribute('src');
          const alt = element.getAttribute('alt') || 'image';
          return `![${alt}](${src})`;
        case 'ul':
          return content;
        case 'ol':
          return content;
        case 'li':
          const parent = element.parentElement;
          if (parent?.tagName.toLowerCase() === 'ul') {
            return `* ${content}\n`;
          } else if (parent?.tagName.toLowerCase() === 'ol') {
            return `1. ${content}\n`;
          }
          return content;
        case 'blockquote':
          return content.split('\n').map(line => `> ${line}`).join('\n') + '\n\n';
        case 'code':
          // Inline code
          if (element.parentElement?.tagName.toLowerCase() !== 'pre') {
            return `\`${content}\``;
          }
          return content;
        case 'pre':
          // Code block
          const codeElement = element.querySelector('code');
          const codeContent = codeElement ? codeElement.textContent : content;
          return `\`\`\`\n${codeContent}\n\`\`\`\n\n`;
        default:
          return content;
      }
    }
    
    return '';
  };
  
  for (const child of Array.from(div.childNodes)) {
    markdown += processNode(child);
  }
  
  // Clean up extra newlines
  markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();
  
  return markdown;
  } catch (error) {
    console.error('Error converting HTML to markdown:', error);
    // Fallback: just strip HTML tags
    return html.replace(/<[^>]*>/g, '').trim();
  }
}

export function markdownToHtml(markdown: string): string {
  // Basic markdown to HTML conversion
  let html = markdown;
  
  // Headers
  html = html.replace(/^###### (.*?)$/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.*?)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.*?)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Strikethrough
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  
  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Lists
  html = html.replace(/^\* (.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  html = html.replace(/^\d+\. (.*)$/gm, '<li>$1</li>');
  
  // Blockquotes
  html = html.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');
  
  // Paragraphs
  html = html.split('\n\n').map(para => {
    if (!para.startsWith('<') && para.trim()) {
      return `<p>${para}</p>`;
    }
    return para;
  }).join('\n');
  
  return html;
}