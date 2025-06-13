import { getMetadata } from '../../scripts/aem.js';
import { isAuthorEnvironment, moveInstrumentation } from '../../scripts/scripts.js';

/**
 * @param {HTMLElement} $block
 */
export default async function decorate(block) {
  console.log(block);

  let inputs = block.querySelectorAll('.dynamicmedia-template > div');
  
  let configSrc = Array.from(block.children)[0]?.textContent?.trim(); //inline or cf

  
  if(configSrc === 'inline'){
    // Get DM Url input
    let templateURL = inputs[1]?.textContent?.trim();
    let variablemapping = inputs[2]?.textContent?.trim();

    if(!templateURL) {
      console.log("Missing mandatory template URL");
      return;
    }

    if (variablemapping) {
      // Step 1: Convert to key-value object
      const paramPairs = variablemapping.match(/[^,]+=[^$]+(?:,?[^,$=][^,]*)*/g);

      const paramObject = {};

      paramPairs.forEach(pair => {
        const indexOfEqual = pair.indexOf('=');
        const key = pair.slice(0, indexOfEqual).trim();
        let value = pair.slice(indexOfEqual + 1).trim();
      
        // 🧹 Remove trailing comma (if any)
        if (value.endsWith(',')) {
          value = value.slice(0, -1);
        }
      
        paramObject[key] = value;
      });
      // Manually construct the query string (preserving `$` in keys)
      const queryString = Object.entries(paramObject)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
      // Combine with template URL (already includes ? or not)
      let finalUrl = templateURL.includes('?') 
        ? `${templateURL}&${queryString}` 
        : `${templateURL}?${queryString}`;

      console.log("Final URL:", finalUrl);

      if (finalUrl) {
        const finalImg = document.createElement('img');
        Object.assign(finalImg, {
          className: 'dm-template-image',
          src: finalUrl,
          alt: 'dm-template-image',
        });
        block.innerHTML = '';
        block.append(finalImg);
      }
    }
  } if(configSrc === 'cf'){

    //https://author-p153659-e1620914.adobeaemcloud.com/graphql/execute.json/wknd-universal/DynamicMediaTemplateByPath;path=
    const CONFIG = {
      WRAPPER_SERVICE_URL: 'https://prod-31.westus.logic.azure.com:443/workflows/2660b7afa9524acbae379074ae38501e/triggers/manual/paths/invoke',
      WRAPPER_SERVICE_PARAMS: 'api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=kfcQD5S7ovej9RHdGZFVfgvA-eEqNlb6r_ukuByZ64o',
      GRAPHQL_QUERY: '/graphql/execute.json/wknd-universal/DynamicMediaTemplateByPath'
    };
    
    const hostname = getMetadata('hostname');	
    const aemauthorurl = getMetadata('authorurl') || '';
    
    const aempublishurl = hostname?.replace('author', 'publish')?.replace(/\/$/, '');  
    
    const persistedquery = '/graphql/execute.json/wknd-universal/DynamicMediaTemplateByPath';

    const contentPath = block.querySelector("p.button-container > a")?.textContent?.trim();
    const isAuthor = isAuthorEnvironment();
  
    // Prepare request configuration based on environment
    const requestConfig = isAuthor 
    ? {
        url: `${aemauthorurl}${CONFIG.GRAPHQL_QUERY};path=${contentPath};ts=${Date.now()}`,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    : {
        url: `${CONFIG.WRAPPER_SERVICE_URL}?${CONFIG.WRAPPER_SERVICE_PARAMS}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graphQLPath: `${aempublishurl}${CONFIG.GRAPHQL_QUERY}`,
          cfPath: contentPath,
          variation: variationname
        })
      };
  
      try {
        // Fetch data
        const response = await fetch(requestConfig.url, {
          method: requestConfig.method,
          headers: requestConfig.headers,
          ...(requestConfig.body && { body: requestConfig.body })
        });
  
        if (!response.ok) {
          console.error(`error making cf graphql request: ${response.status}`);
        }
  
        const offer = await response.json();
        // Get the template URL and parameter mappings
        const templateURL = offer?.data?.dynamicMediaTemplateModelByPath?.item?.dm_template;
        const paramPairs = offer?.data?.dynamicMediaTemplateModelByPath?.item?.var_mapping;

        // Create parameter object
        const paramObject = {};

        // Process each parameter pair
        paramPairs.forEach(pair => {
          const indexOfEqual = pair.indexOf('=');
          const key = pair.slice(0, indexOfEqual).trim();
          let value = pair.slice(indexOfEqual + 1).trim();

          // Remove trailing comma if any
          if (value.endsWith(',')) {
            value = value.slice(0, -1);
          }
          paramObject[key] = value;
        });

        // Construct the query string (preserving `$` in keys)
        const queryString = Object.entries(paramObject)
          .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
          .join('&');

        // Combine with template URL
        let finalUrl = templateURL.includes('?') 
          ? `${templateURL}&${queryString}` 
          : `${templateURL}?${queryString}`;

        console.log("Final URL:", finalUrl);

        // Create and append the image element
        if (finalUrl) {
          const finalImg = document.createElement('img');
          Object.assign(finalImg, {
            className: 'dm-template-image',
            src: finalUrl,
            alt: 'dm-template-image',
          });
          
          block.innerHTML = '';
          block.append(finalImg);
        }
      } catch (error) {
        console.error('error rendering content fragment:', error);
      }
  }
   
}
