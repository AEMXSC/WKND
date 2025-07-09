import {
  loadHeader,
  loadFooter,
  decorateButtons as libDecorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadBlocks,
  loadCSS,
  fetchPlaceholders,
  getMetadata,
  loadScript,
  toClassName,
  toCamelCase
} from './aem.js';
import { picture, source, img } from './dom-helpers.js';

import {
  getLanguage,
  formatDate,
  setPageLanguage,
  PATH_PREFIX,
} from './utils.js';

const experimentationConfig = {
  prodHost: 'www.my-site.com',
  audiences: {
    mobile: () => window.innerWidth < 600,
    desktop: () => window.innerWidth >= 600,
    // define your custom audiences here as needed
  }
};

let runExperimentation;
let showExperimentationOverlay;
const isExperimentationEnabled = document.head.querySelector('[name^="experiment"],[name^="campaign-"],[name^="audience-"],[property^="campaign:"],[property^="audience:"]')
    || [...document.querySelectorAll('.section-metadata div')].some((d) => d.textContent.match(/Experiment|Campaign|Audience/i));
if (isExperimentationEnabled) {
  ({
    loadEager: runExperimentation,
    loadLazy: showExperimentationOverlay,
  } = await import('../plugins/experimentation/src/index.js'));
}

/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

export function isAuthorEnvironment() {
  if(window?.location?.origin?.includes('author')){
    return true;
  }else{
    return false;
  }
  /*
  if(document.querySelector('*[data-aue-resource]') !== null){
    return true;
  }*/
  //return false;
}

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Return the placeholder file specific to language
 * @returns
 */
export async function fetchLanguagePlaceholders() {
  const langCode = getLanguage();
  try {
    // Try fetching placeholders with the specified language
    return await fetchPlaceholders(`${PATH_PREFIX}/${langCode}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error fetching placeholders for lang: ${langCode}. Will try to get en placeholders`, error);
    // Retry without specifying a language (using the default language)
    try {
      return await fetchPlaceholders(`${PATH_PREFIX}/en`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching placeholders:', err);
    }
  }
  return {}; // default to empty object
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks() {
  try {
    // TODO: add auto block, if needed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function decorateButtons(main) {
  main.querySelectorAll('img').forEach((img) => {
    let altT = decodeURIComponent(img.alt);

    if (altT && altT.includes('https://delivery-')) {
      try {
        altT = JSON.parse(altT);
        const { altText, deliveryUrl } = altT;
        const url = new URL(deliveryUrl);
        const imgName = url.pathname.substring(url.pathname.lastIndexOf('/') + 1);
        const block = whatBlockIsThis(img);
        const bp = getMetadata(block);
        let breakpoints = [{ media: '(min-width: 600px)', width: '2000' }, { width: '750' }];
        if (bp) {
          const bps = bp.split('|');
          const bpS = bps.map((b) => b.split(',').map((p) => p.trim()));
          breakpoints = bpS.map((n) => {
            const obj = {};
            n.forEach((i) => {
              const t = i.split(/:(.*)/s);
              obj[t[0].trim()] = t[1].trim();
            });
            return obj;
          });
        } else {
          const format = getMetadata(imgName.toLowerCase().replace('.', '-'));
          const formats = format.split('|');
          const formatObj = {};
          formats.forEach((i) => {
            const [a, b] = i.split('=');
            formatObj[a] = b;
          });
          breakpoints = breakpoints.map((n) => (
            { ...n, ...formatObj }
          ));
        }
        const picture = createOptimizedPicture(deliveryUrl, altText, false, breakpoints);
        img.parentElement.replaceWith(picture);
      } catch (error) {
        img.setAttribute('style', 'border:5px solid red');
        img.setAttribute('data-asset-type', 'video');
        img.setAttribute('title', 'Update block to render video.');
      }
    }
  });
  libDecorateButtons(main);
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateDMImages(main);
}


async function renderWBDataLayer() {
  
  const config = await fetchPlaceholders(PATH_PREFIX);
  const lastPubDateStr = getMetadata('published-time');
  const firstPubDateStr = getMetadata('content_date') || lastPubDateStr;
  window.wbgData.page = {
    pageInfo: {
      pageCategory: getMetadata('pagecategory'),
      channel: getMetadata('channel'),
      themecfreference: getMetadata('theme_cf_reference'),
      contentType: getMetadata('content_type'),
      pageUid: getMetadata('pageuid'),
      pageName: getMetadata('pagename'),
      hostName: getMetadata('hostname'),
      pageFirstPub: formatDate(firstPubDateStr),
      pageLastMod: formatDate(lastPubDateStr),
      webpackage: '',
    },
  };
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  //setPageLanguage();
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  renderWBDataLayer();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  // Add below snippet early in the eager phase
  if (runExperimentation) {
    await runExperimentation(document, experimentationConfig);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();

  // Add below snippet at the end of the lazy phase
  if (showExperimentationOverlay) {
    await showExperimentationOverlay(document, experimentationConfig);
  }
}


/**
 * Decorates Dynamic Media images by modifying their URLs to include specific parameters
 * and creating a <picture> element with different sources for different image formats and sizes.
 *
 * @param {HTMLElement} main - The main container element that includes the links to be processed.
 */
export function decorateDMImages(main) {
  main.querySelectorAll('a[href^="https://delivery-p"]').forEach((a) => {
    const url = new URL(a.href.split('?')[0]);
    if (url.hostname.endsWith('.adobeaemcloud.com')) {

        const blockBeingDecorated = whatBlockIsThis(a);
        let blockName = '';
        let rotate = '';
        let flip = '';
        let crop = '';
        if(blockBeingDecorated){
            blockName = Array.from(blockBeingDecorated.classList).find(className => className !== 'block');
        }
        if(blockName && blockName === 'dynamicmedia-image'){
          rotate = blockBeingDecorated?.children[3]?.textContent?.trim();
          flip = blockBeingDecorated?.children[4]?.textContent?.trim();
          crop = blockBeingDecorated?.children[5]?.textContent?.trim();
        }

        const uuidPattern = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
        const match = url.href?.match(uuidPattern);
        let aliasname = '';
        if (!match) {
            throw new Error('No asset UUID found in URL');
        }else{
          aliasname = match[1];
        }
        let hrefWOExtn =  url.href?.substring(0, url.href?.lastIndexOf('.'))?.replace(/\/original\/(?=as\/)/, '/');
        const pictureEl = picture(
          source({ 
              srcset: `${hrefWOExtn}.webp?width=1400&quality=85&preferwebp=true${rotate ? '&rotate=' + rotate : ''}${flip ? '&flip=' + flip.toLowerCase() : ''}${crop ? '&crop=' + crop.toLowerCase() : ''}`, 
              type: 'image/webp', 
              media: '(min-width: 992px)' 
          }),
          source({ 
              srcset: `${hrefWOExtn}.webp?width=1320&quality=85&preferwebp=true${rotate ? '&rotate=' + rotate : ''}${flip ? '&flip=' + flip.toLowerCase() : ''}${crop ? '&crop=' + crop.toLowerCase() : ''}`, 
              type: 'image/webp', 
              media: '(min-width: 768px)' 
          }),
          source({ 
              srcset: `${hrefWOExtn}.webp?width=780&quality=85&preferwebp=true${rotate ? '&rotate=' + rotate : ''}${flip ? '&flip=' + flip.toLowerCase() : ''}${crop ? '&crop=' + crop.toLowerCase() : ''}`, 
              type: 'image/webp', 
              media: '(min-width: 320px)' 
          }),
          source({ 
              srcset: `${hrefWOExtn}.webp?width=1400&quality=85${rotate ? '&rotate=' + rotate : ''}${flip ? '&flip=' + flip.toLowerCase() : ''}${crop ? '&crop=' + crop.toLowerCase() : ''}`, 
              media: '(min-width: 992px)' 
          }),
          source({ 
              srcset: `${hrefWOExtn}.webp?width=1320&quality=85${rotate ? '&rotate=' + rotate : ''}${flip ? '&flip=' + flip.toLowerCase() : ''}${crop ? '&crop=' + crop.toLowerCase() : ''}`, 
              media: '(min-width: 768px)' 
          }),
          source({ 
              srcset: `${hrefWOExtn}.webp?width=780&quality=85${rotate ? '&rotate=' + rotate : ''}${flip ? '&flip=' + flip.toLowerCase() : ''}${crop ? '&crop=' + crop.toLowerCase() : ''}`, 
              media: '(min-width: 320px)' 
          }),
          img({ 
              src: `${hrefWOExtn}.webp?width=1400&quality=85${rotate ? '&rotate=' + rotate : ''}${flip ? '&flip=' + flip.toLowerCase() : ''}${crop ? '&crop=' + crop.toLowerCase() : ''}`, 
              alt: a.innerText 
          }),
        );
      a.replaceWith(pictureEl);
    }
  });
}

function whatBlockIsThis(element) {
  let currentElement = element;

  while (currentElement.parentElement) {
    if (currentElement.parentElement.classList.contains('block')) return currentElement.parentElement;
    currentElement = currentElement.parentElement;
    if (currentElement.classList.length > 0) return currentElement.classList[0];
  }
  return null;
}

/**
 * remove the adujusts the auto images
 * @param {Element} main The container element
 */
function adjustAutoImages(main) {
  const pictureElement = main.querySelector('div > p > picture');
  if (pictureElement) {
    const pElement = pictureElement.parentElement;
    pElement.className = 'auto-image-container';
  }
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  window.wbgData ||= {};
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
