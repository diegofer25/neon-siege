/**
 * @fileoverview Shared helper for rendering skill/attribute/ascension icons.
 *
 * Returns an `<img>` tag if `iconImage` exists, with an `onerror` fallback to
 * the emoji `icon` string.  Falls back to plain emoji when no image path is set.
 */

/**
 * Build an HTML string for a skill/modifier icon.
 * @param {{ icon?: string, iconImage?: string, name?: string }} item
 * @param {number} [size=24]  CSS width/height in px
 * @returns {string} HTML — either an `<img>` or the emoji text
 */
export function skillIconHtml(item, size = 24) {
	if (item.iconImage) {
		const alt = (item.name || '').replace(/'/g, '&#39;');
		const emoji = (item.icon || '✨').replace(/'/g, '&#39;');
		return `<img src="${item.iconImage}" alt="${alt}" width="${size}" height="${size}" class="skill-icon-img" onerror="this.outerHTML='${emoji}'">`;
	}
	return item.icon || '✨';
}
