export function webUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function postMessage(caption, link) {
  return link ? `${caption.trim()}\n\n${link.trim()}` : caption.trim();
}

export function graphPost(pageId, caption, link, image) {
  if (image) return { path: `${pageId}/photos`, body: { url: image, caption: postMessage(caption, link), published: 'true' } };
  return { path: `${pageId}/feed`, body: { message: caption.trim(), ...(link && { link }) } };
}

export function facebookPostUrl(pageId, result) {
  const postId = result.post_id ?? result.id;
  if (typeof postId !== 'string') return null;
  if (postId.startsWith(`${pageId}_`) && /^\d+_\d+$/.test(postId)) {
    return `https://www.facebook.com/${pageId}/posts/${postId.split('_')[1]}`;
  }
  return /^\d+$/.test(postId) ? `https://www.facebook.com/${postId}` : null;
}
