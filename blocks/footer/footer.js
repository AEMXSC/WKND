import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import {
  getLanguage, getSiteName, TAG_ROOT, PATH_PREFIX, fetchLanguageNavigation,
} from '../../scripts/utils.js';

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const footerMeta = getMetadata('footer');
  const langCode = getLanguage();
  
  const footerPath = footerMeta
    ? new URL(footerMeta, window.location).pathname
    : `/content/${getSiteName()}${PATH_PREFIX}/footer`;
  
  const fragment = await loadFragment(footerPath);

  // decorate footer DOM
  block.textContent = '';
  const footer = document.createElement('div');
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);

  block.append(footer);
}
