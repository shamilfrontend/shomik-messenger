const ICQ_FILENAME_RE = /^[A-Za-z0-9._-]+\.gif$/;

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}[^\s<>"']*)/gi;

export const hasLinks = (content: string): boolean => {
  if (!content) return false;
  URL_RE.lastIndex = 0;
  return URL_RE.test(content);
};

export const hasIcqSmiles = (content: string): boolean => /\[icq:[^\]]+\.gif\]/.test(content || '');

export const renderMessageContent = (content: string, linkClass: string, icqClass: string): string => {
  if (!content) return '';

  const icqPlaceholders: string[] = [];
  let result = content.replace(
    /\[icq:([^\]]+\.gif)\]/g,
    (_match, filename: string) => {
      const placeholder = `__ICQ_PLACEHOLDER_${icqPlaceholders.length}__`;
      if (!ICQ_FILENAME_RE.test(filename)) {
        icqPlaceholders.push(escapeHtml(`[icq:${filename}]`));
        return placeholder;
      }
      const safeName = escapeHtml(filename);
      icqPlaceholders.push(
        `<img src="/images/icq_smiles_hd/${safeName}" alt="${safeName}" class="${icqClass}" />`,
      );
      return placeholder;
    },
  );

  result = escapeHtml(result);

  result = result.replace(URL_RE, (url) => {
    if (url.includes('__ICQ_PLACEHOLDER')) {
      return url;
    }
    let href = url;
    if (!/^https?:\/\//i.test(url)) {
      href = /^www\./i.test(url) ? `http://${url}` : `https://${url}`;
    }
    const escapedHref = escapeHtml(href);
    return `<a href="${escapedHref}" target="_blank" rel="noopener noreferrer" class="${linkClass}">${escapeHtml(url)}</a>`;
  });

  icqPlaceholders.forEach((html, index) => {
    result = result.replace(`__ICQ_PLACEHOLDER_${index}__`, html);
  });

  return result;
};
