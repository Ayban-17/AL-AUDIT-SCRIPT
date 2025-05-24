/**
 * Link Extractor Script - Updated Version (User-Tools-Info + Cruise Ship Checking + Special Destination Pages)
 * 
 * This script extracts all links (hrefs and their labels) from the .al-main element,
 * organizing them by:
 * 1. Section type (sumtiles, tiles, four, table, text, stories, articles)
 * 2. URL structure patterns (destination, destination/tours/activity, destination/cruises/idNumber, etc.)
 * 
 * It also provides functions to check if destinations, activities, cruises, and tours are still available by:
 * - For ALL destinations (level 1+): Checking against .al-user-tools-info > div:first-child span content
 * - For activities: Checking if the activity exists in experience/activity option lists
 * - For tours: Checking if the price element exists and is greater than zero
 * - For cruise ships (/cruises/ID/ship-name): Checking ship list on current-page/tours
 * - For cruises (/destination/cruises/ID/cruise-name): Checking if the price element exists and is greater than zero
 * 
 * UPDATED: Now uses user-tools-info method for ALL destination levels AND includes cruise ship checking
 * UPDATED: Now detects and skips special destination pages (/land-tours, /ships, /videos, /myTrips)
 */


// Function to determine URL structure pattern - FINAL VERSION with proper ordering
function determineUrlPattern(href) {
  let path = href;
  
  // Handle full URLs (with domain)
  if (href.startsWith('http')) {
    try {
      const urlObj = new URL(href);
      const currentDomain = window.location.hostname;
      
      // If it's the same domain, extract just the path
      if (urlObj.hostname === currentDomain || 
          urlObj.hostname === `www.${currentDomain}` || 
          currentDomain === `www.${urlObj.hostname}`) {
        path = urlObj.pathname;
      } else {
        // Different domain = truly external
        return 'external';
      }
    } catch (e) {
      // Invalid URL format
      return 'external';
    }
  }
  
  // Remove leading slash if present
  path = path.startsWith('/') ? path.substring(1) : path;
  
  // DISTINGUISH: Cruise ships vs destination cruises (check early)
  if (path.match(/^cruises\/\d+/)) {
    // Direct cruise ship: /cruises/ID/ship-name
    return 'cruise-ship';
  }
  
  if (path.match(/\/cruises\/\d+/)) {
    // Destination cruise: /destination/cruises/ID/cruise-name
    return 'cruise-with-id';
  }
  
  if (path.match(/tours\/\d+/)) {
    return 'tour-with-id';
  }

  if (path.match(/operators\/\d+/)) {
    return 'operator-with-id';
  }
  
  // Activity pages - CHECK AFTER ID patterns to avoid conflicts
  if (path.match(/tours\/[^\/\d]+$/)) {
    return 'tour-activity';
  }
  
  // Smart pattern detection - handles any number of subdestination levels
  const pathSegments = path.split('/').filter(segment => segment.length > 0);

  // FIRST: Check for specific content patterns with names (these should be skipped, not special destinations)
  if (pathSegments.length >= 3) {
    const secondToLast = pathSegments[pathSegments.length - 2];
    const last = pathSegments[pathSegments.length - 1];
    
    // Articles with article name - these are content pages, not special destinations
    if (secondToLast === 'articles') {
      console.log(`DEBUG: Found article with name pattern for ${href} - returning multi-level/articles/article-name`);
      return 'multi-level/articles/article-name';
    }
    
    // Stories with story name  
    if (secondToLast === 'stories') {
      return 'multi-level/stories/story-name';
    }
    
    // Tours with activity name (non-numeric)
    if (secondToLast === 'tours' && !/^\d+$/.test(last)) {
      return 'multi-level/tours/activity';
    }
  }

  // SECOND: Check for special destination pages (destination + special ending)
  const lastSegment = pathSegments[pathSegments.length - 1];
  
  // 1. ALWAYS SPECIAL - only exact endings (no additional path after)
  const alwaysSpecialEndings = ['land-tours', 'ships', 'videos', 'myTrips'];
  
  if (alwaysSpecialEndings.includes(lastSegment)) {
    console.log(`DEBUG: Found always special ending for ${href} - returning destination-special-page`);
    return 'destination-special-page';
  }

  // 2. SPECIAL ONLY IF HAS DESTINATION PREFIX 
  const destinationSpecialEndings = ['cruises', 'tours', 'hotels', 'deals', 'info', 'articles'];
  
  if (destinationSpecialEndings.includes(lastSegment)) {
    // Make sure this is actually a destination+ending, not just the category page itself
    if (pathSegments.length === 1) {
      // It's just the root category page itself (e.g., "cruises", "tours") - handle below
    } else {
      // If it has a destination prefix (e.g., "iceland/cruises"), treat as special destination page
      console.log(`DEBUG: Found destination special ending for ${href} - returning destination-special-page`);
      return 'destination-special-page';
    }
  }

  // THIRD: Check for root category pages (only single segment)
  if (pathSegments.length === 1) {
    const segment = pathSegments[0];
    
    if (segment === 'articles') {
      return 'multi-level/articles';
    }
    if (segment === 'stories') {
      return 'multi-level/stories';
    }
    if (segment === 'tours') {
      return 'multi-level/tours-category';
    }
    if (segment === 'cruises') {
      return 'multi-level/cruises-category';
    }
    if (segment === 'deals') {
      return 'multi-level/deals';
    }
  }
  
  // General destination categories (legacy patterns)
  if (path.match(/\/tours$/)) {
    return 'tours-category';
  }
  
  if (path.match(/\/cruises$/)) {
    return 'cruises-category';
  }
  
  // Multi-level destinations (1-5+ levels, no special suffixes)
  if (pathSegments.length >= 1) {
    // Check if any segment contains non-destination keywords
    const nonDestinationSegments = ['articles', 'stories', 'deals', 'tours', 'cruises', 'operators'];
    const hasNonDestination = pathSegments.some(segment => nonDestinationSegments.includes(segment));
    
    if (!hasNonDestination) {
      return `multi-level/destination-${pathSegments.length}`;
    }
  }

  // Default case
  console.log(`DEBUG: No pattern matched for ${href} - returning other`);
  return 'other';
}

// Helper function to normalize text for better matching
function normalizeText(text) {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .replace(/&/g, '')             // Remove & completely
    .replace(/\+/g, '')            // Remove + completely  
    .replace(/\s+/g, ' ')          // Multiple spaces → single space
    .trim();
}

function textsMatch(text1, text2) {
  if (!text1 || !text2) return false;
  
  const normalized1 = normalizeText(text1);
  const normalized2 = normalizeText(text2);
  
  // Direct match
  if (normalized1 === normalized2) return true;
  
  // Contains match (both ways)
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) return true;
  
  // Split and check individual words for partial matches
  const words1 = normalized1.split(' ').filter(w => w.length > 2);
  const words2 = normalized2.split(' ').filter(w => w.length > 2);
  
  // Check if any significant word from text2 is in text1
  return words2.some(word => normalized1.includes(word)) || 
         words1.some(word => normalized2.includes(word));
}

// Helper function to detect maintenance or error status
function detectPageStatus(iframeDoc, response) {
  try {
    // Check for 404 specifically
    if (response && response.status === 404) {
      return { status: 'broken_link_404', message: 'Broken Link 404 - Page not found' };
    }
    
    // Check for maintenance HTTP status codes
    if (response && [502, 503, 504].includes(response.status)) {
      return { status: 'under_maintenance', message: `Server error ${response.status} - Under maintenance` };
    }
    
    if (!iframeDoc || !iframeDoc.body) {
      return { status: 'loading_error', message: 'Page content not loaded' };
    }
    
    const bodyText = iframeDoc.body.textContent.toLowerCase();
    const titleText = (iframeDoc.title || '').toLowerCase();
    
    // Check for maintenance keywords
    const maintenanceKeywords = [
      'under maintenance',
      'temporarily unavailable', 
      'maintenance mode',
      'service temporarily unavailable',
      'site maintenance',
      'under construction',
      'temporarily down',
      'service unavailable',
      '503 service unavailable',
      'maintenance in progress'
    ];
    
    for (const keyword of maintenanceKeywords) {
      if (bodyText.includes(keyword) || titleText.includes(keyword)) {
        return { status: 'under_maintenance', message: `Under maintenance - Found: "${keyword}"` };
      }
    }
    
    // Check if page is essentially empty (likely an error)
    if (bodyText.trim().length < 100) {
      return { status: 'loading_error', message: 'Page appears to be empty or not fully loaded' };
    }
    
    // Page seems to be loaded normally
    return { status: 'loaded', message: 'Page loaded successfully' };
    
  } catch (error) {
    return { status: 'loading_error', message: `Error detecting page status: ${error.message}` };
  }
}

// Helper function for retry logic
async function retryWithMaintenanceDetection(checkFunction, maxRetries = 3, retryDelay = 10000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await checkFunction(attempt);
      
      // If successful or it's a 404 (no retry needed), return immediately
      if (result.pageStatus === 'loaded' || result.pageStatus === 'broken_link_404') {
        return result;
      }
      
      // If it's the last attempt, return the result as-is
      if (attempt === maxRetries) {
        return {
          ...result,
          finalStatus: result.pageStatus === 'under_maintenance' ? 'under_maintenance' : 'timeout',
          retryAttempts: attempt
        };
      }
      
      // Wait before retrying (but not on last attempt)
      console.log(`Attempt ${attempt}/${maxRetries} failed: ${result.pageStatus}. Retrying in ${retryDelay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
    } catch (error) {
      if (attempt === maxRetries) {
        return {
          available: false,
          error: `Failed after ${maxRetries} attempts: ${error.message}`,
          pageStatus: 'timeout',
          finalStatus: 'timeout',
          retryAttempts: attempt
        };
      }
      
      console.log(`Attempt ${attempt}/${maxRetries} error: ${error.message}. Retrying in ${retryDelay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

function urlPathToReadableText(url) {
  // Extract the last part of the path
  let path = url;
  
  // Remove leading slash and domain if present
  if (path.startsWith('http')) {
    const urlObj = new URL(path);
    path = urlObj.pathname;
  }
  
  if (path.startsWith('/')) {
    path = path.substring(1);
  }
  
  // If path has multiple segments, take the last segment or the second-to-last if it's a destination/subdestination pattern
  const segments = path.split('/');
  let textSegment = '';
  
  if (segments.length > 1) {
    // For destination/subdestination pattern, use the last segment
    textSegment = segments[segments.length - 1];
    
    // If the last segment looks like an ID or specific page, use the second-to-last segment
    if (/^\d+$/.test(textSegment) || textSegment.startsWith('tours') || textSegment.startsWith('cruises')) {
      textSegment = segments[segments.length - 2];
    }
  } else {
    textSegment = segments[0];
  }
  
  // Replace hyphens with spaces
  let text = textSegment.replace(/-/g, ' ');
  
  // Capitalize each word
  text = text.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  return text;
}

function isTrueDestination(path, pattern) {
  // Remove leading slash
  if (path.startsWith('/')) {
    path = path.substring(1);
  }
  
  // SKIP special destination pages
  if (pattern === 'destination-special-page') {
    return false; // These are special destination pages that should be skipped
  }
  
  // MODIFIED: Special handling for tour/cruise/operator link patterns
  if (pattern === 'tour-with-id' || pattern === 'cruise-with-id' || 
      pattern === 'tour-activity' || pattern === 'tours-category' || 
      pattern === 'cruises-category' || pattern === 'operator-with-id') {
    return true;
  }
  
  // FLEXIBLE: Handle all multi-level content pages as non-destinations
  if (pattern.includes('/articles') || 
      pattern.includes('/stories') ||
      pattern.includes('/deals') ||
      pattern.includes('/tours') ||
      pattern.includes('/cruises')) {
    return false; // These are content pages, not destinations
  }
  
  // FLEXIBLE: Handle multi-level destinations
  if (pattern.startsWith('multi-level/destination-')) {
    return true; // These are actual destination pages
  }
  
  // Legacy patterns for backward compatibility
  if (pattern === 'destination' || pattern === 'destination/subdestination') {
    const segments = path.split('/');
    const nonDestinationSegments = [
      'articles', 'stories', 'deals', 'guides', 'contact',
      'about', 'faq', 'reviews', 'news', 'gallery', 'photos',
      'blog', 'privacy', 'terms', 'careers', 'events'
    ];
    
    for (const segment of segments) {
      if (nonDestinationSegments.includes(segment)) {
        return false;
      }
    }
    return true;
  }
  
  return false;
}

// Helper function to extract links from a specific element
function extractLinksFromElement(element, sectionType = null) {
  const links = [];
  const anchorElements = element.querySelectorAll('a[href]');
  
  anchorElements.forEach(anchor => {
    // Get the href attribute
    const href = anchor.getAttribute('href');
    
    // Skip empty hrefs or javascript: links
    if (!href || href === '#' || href.startsWith('javascript:')) {
      return;
    }
    
    // Get the text content
    let text = '';
    
    // First try to get text from the title h3 if it exists
    const titleElement = anchor.querySelector('.al-lnk-title h3');
    if (titleElement) {
      text = titleElement.textContent.trim();
    } 
    // Try to get from a header if no title found
    else if (!text) {
      const headerElement = anchor.querySelector('h1, h2, h3, h4, h5, h6');
      if (headerElement) {
        text = headerElement.textContent.trim();
      }
    }
    
    // Fall back to the anchor text content if no specific text found
    if (!text) {
      text = anchor.textContent.trim();
      
      // Clean up the text by removing excessive whitespace
      text = text.replace(/\s+/g, ' ').trim();
      
      // If the text is too long, it's probably not just a label
      if (text.length > 100) {
        // Try to use title attribute or just href basename
        text = anchor.getAttribute('title') || 
               href.split('/').pop().replace(/[-_]/g, ' ').trim() ||
               '[No text label]';
      }
    }
    
    // If still empty, try to get from img alt or title
    if (!text) {
      const img = anchor.querySelector('img');
      if (img) {
        text = img.getAttribute('alt') || img.getAttribute('title') || '';
      }
    }
    
    // If still no text, use the title attribute of the anchor or a fallback
    if (!text) {
      text = anchor.getAttribute('title') || '[No text]';
    }
    
    // Determine URL pattern
    const urlPattern = determineUrlPattern(href);

    // Check for description based on section type
    let hasDescription = false;
    if (sectionType) {
      const sectionTypeLower = sectionType.toLowerCase();
      let descriptionSelector = '';
      
      if (['four', 'sumtiles', 'articles'].includes(sectionTypeLower)) {
        descriptionSelector = '.al-lnk-details';
      } else if (sectionTypeLower === 'table') {
        descriptionSelector = '.al-lp-table-summary';
      }
      
      if (descriptionSelector) {
        const descriptionElement = anchor.querySelector(descriptionSelector);
        if (descriptionElement && descriptionElement.textContent.trim().length > 0) {
          hasDescription = true;
        }
      }
    }

    // Add the link to our results
    links.push({
      text: text,
      href: href,
      urlPattern: urlPattern,
      isExternal: href.startsWith('http') && !href.includes(window.location.hostname),
      hasDescription: hasDescription
    });
  });
  
  return links;
}

// Function to check if a tour is still available with retry logic
async function checkTourAvailability(url, originalTitle) {
  // Wrapper function for retry logic
  const checkTourAttempt = (attempt) => {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      
      const urlAsText = urlPathToReadableText(url);
      let tourId = null;
      const tourIdMatch = url.match(/\/tours\/(\d+)/);
      if (tourIdMatch && tourIdMatch[1]) {
        tourId = tourIdMatch[1];
      }
      
      const timeout = setTimeout(() => {
        document.body.removeChild(iframe);
        resolve({
          url: url,
          originalTitle: originalTitle,
          urlAsText: urlAsText,
          tourId: tourId,
          available: false,
          pageStatus: 'timeout',
          error: `Attempt ${attempt}: Timeout while loading page`
        });
      }, 15000);
      
      const checkPrice = (iframeDoc, httpResponse = null) => {
        try {
          // First check page status
          const pageStatus = detectPageStatus(iframeDoc, httpResponse);
          
          if (pageStatus.status !== 'loaded') {
            clearTimeout(timeout);
            document.body.removeChild(iframe);
            resolve({
              url: url,
              originalTitle: originalTitle,
              urlAsText: urlAsText,
              tourId: tourId,
              available: false,
              pageStatus: pageStatus.status,
              error: `Attempt ${attempt}: ${pageStatus.message}`
            });
            return;
          }
          
          // Page loaded successfully, check price
          const priceSelectors = [
            '.al-price-summary .al-amount',
            '.al-price-summary .al-price-min .al-amount',
            '.al-price-summary .al-price .al-amount',
            '.al-price-min .al-amount',
            '.al-price .al-amount',
            '[class*="price"] .al-amount',
            '.al-amount'
          ];
          
          let priceElement = null;
          let priceSelector = '';
          
          for (const selector of priceSelectors) {
            const element = iframeDoc.querySelector(selector);
            if (element) {
              priceElement = element;
              priceSelector = selector;
              break;
            }
          }
          
          let price = null;
          let priceText = null;
          
          if (priceElement) {
            priceText = priceElement.textContent.trim();
            const priceMatch = priceText.match(/[\d,]+/);
            if (priceMatch) {
              price = parseFloat(priceMatch[0].replace(/,/g, ''));
            }
          }
          
          console.log(`Attempt ${attempt} - Checking tour: ${url}`);
          console.log(`Price text found: ${priceText}`);
          console.log(`Parsed price: ${price}`);
          
          const available = price !== null && price > 0;
          const pageTitle = iframeDoc.querySelector('h1')?.textContent.trim() || iframeDoc.title || null;
          const departureInfo = iframeDoc.querySelector('.al-tour-departure')?.textContent.trim() || null;
          const durationInfo = iframeDoc.querySelector('.al-tour-duration')?.textContent.trim() || null;
          // LOG UNAVAILABLE TOURS
if (!available) {
  console.log(`❌ UNAVAILABLE TOUR DETECTED:`);
  console.log(`   URL: ${url}`);
  console.log(`   Original Title: "${originalTitle}"`);
  console.log(`   Tour ID: ${tourId}`);
  console.log(`   Price Text: "${priceText || 'NOT FOUND'}"`);
  console.log(`   Parsed Price: ${price}`);
  console.log(`   Page Title: "${pageTitle || 'NOT FOUND'}"`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}
          clearTimeout(timeout);
          document.body.removeChild(iframe);
          resolve({
            url: url,
            originalTitle: originalTitle,
            urlAsText: urlAsText,
            tourId: tourId,
            priceText: priceText,
            price: price,
            pageTitle: pageTitle,
            departureInfo: departureInfo,
            durationInfo: durationInfo,
            available: available,
            pageStatus: 'loaded',
            priceSelector: priceSelector,
            error: null
          });
        } catch (error) {
          clearTimeout(timeout);
          document.body.removeChild(iframe);
          resolve({
            url: url,
            originalTitle: originalTitle,
            urlAsText: urlAsText,
            tourId: tourId,
            available: false,
            pageStatus: 'loading_error',
            error: `Attempt ${attempt}: ${error.message}`
          });
        }
      };
      
      iframe.onload = () => {
        setTimeout(() => {
          try {
            const iframeDoc = iframe.contentWindow.document;
            
            if (!iframeDoc || !iframeDoc.body || iframeDoc.body.innerHTML.length < 100) {
              setTimeout(() => {
                try {
                  checkPrice(iframe.contentWindow.document);
                } catch (e) {
                  clearTimeout(timeout);
                  document.body.removeChild(iframe);
                  resolve({
                    url: url,
                    originalTitle: originalTitle,
                    urlAsText: urlAsText,
                    tourId: tourId,
                    available: false,
                    pageStatus: 'loading_error',
                    error: `Attempt ${attempt}: Page content not loaded properly`
                  });
                }
              }, 3000);
            } else {
              checkPrice(iframeDoc);
            }
          } catch (error) {
            clearTimeout(timeout);
            document.body.removeChild(iframe);
            resolve({
              url: url,
              originalTitle: originalTitle,
              urlAsText: urlAsText,
              tourId: tourId,
              available: false,
              pageStatus: 'loading_error',
              error: `Attempt ${attempt}: Error accessing iframe content`
            });
          }
        }, 2000);
      };
      
      iframe.onerror = (error) => {
        clearTimeout(timeout);
        document.body.removeChild(iframe);
        resolve({
          url: url,
          originalTitle: originalTitle,
          urlAsText: urlAsText,
          tourId: tourId,
          available: false,
          pageStatus: 'loading_error',
          error: `Attempt ${attempt}: Error loading page`
        });
      };
      
      iframe.src = url;
    });
  };
  
  // Use retry logic
  return await retryWithMaintenanceDetection(checkTourAttempt);
}

// Function to check if a cruise ship is available with retry logic
async function checkCruiseShipAvailability(url, originalTitle) {
  const checkShipAttempt = (attempt) => {
    return new Promise((resolve) => {
      let shipName = null;
      const shipMatch = url.match(/\/cruises\/\d+\/([^\/]+)/);
      if (shipMatch && shipMatch[1]) {
        shipName = shipMatch[1].replace(/-/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
      
      const currentPath = window.location.pathname;
      let basePath = currentPath;
      if (basePath.endsWith('/')) {
        basePath = basePath.slice(0, -1);
      }
      
      const toursUrl = `${basePath}/tours`;
      const absoluteToursUrl = `${window.location.origin}${toursUrl}`;
      
      console.log(`Attempt ${attempt} - Checking cruise ship: ${url}`);
      console.log(`Ship name extracted: ${shipName}`);
      console.log(`Tours page URL: ${absoluteToursUrl}`);
      
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      
      const timeout = setTimeout(() => {
        document.body.removeChild(iframe);
        resolve({
          url: url,
          originalTitle: originalTitle,
          shipName: shipName,
          toursUrl: absoluteToursUrl,
          available: false,
          pageStatus: 'timeout',
          error: `Attempt ${attempt}: Timeout while loading tours page`
        });
      }, 15000);
      
      const checkShipList = (iframeDoc, httpResponse = null) => {
        try {
          const pageStatus = detectPageStatus(iframeDoc, httpResponse);
          
          if (pageStatus.status !== 'loaded') {
            clearTimeout(timeout);
            document.body.removeChild(iframe);
            resolve({
              url: url,
              originalTitle: originalTitle,
              shipName: shipName,
              toursUrl: absoluteToursUrl,
              available: false,
              pageStatus: pageStatus.status,
              error: `Attempt ${attempt}: ${pageStatus.message}`
            });
            return;
          }
          
          const shipListContainer = iframeDoc.querySelector('.al-il-fields-ship ul');
          let shipOptions = [];
          
          if (shipListContainer) {
            const shipLabels = shipListContainer.querySelectorAll('li label');
            shipLabels.forEach(label => {
              const text = label.textContent.trim();
              if (text) shipOptions.push(text);
            });
          }
          
          console.log(`Attempt ${attempt} - Ships found on tours page: ${shipOptions.length}`);
          console.log(`Ship options:`, shipOptions);
          
          let shipAvailable = false;
          
          if (shipName && shipOptions.length > 0) {
            shipAvailable = shipOptions.some(option => 
              option.toLowerCase().includes(shipName.toLowerCase()) || 
              shipName.toLowerCase().includes(option.toLowerCase()) ||
              (originalTitle && (
                option.toLowerCase().includes(originalTitle.toLowerCase()) ||
                originalTitle.toLowerCase().includes(option.toLowerCase())
              ))
            );
          }
          
          const pageTitle = iframeDoc.querySelector('h1')?.textContent.trim() || 
                            iframeDoc.title || 
                            null;
          // LOG UNAVAILABLE CRUISE SHIPS
if (!shipAvailable) {
  console.log(`❌ UNAVAILABLE CRUISE SHIP DETECTED:`);
  console.log(`   URL: ${url}`);
  console.log(`   Original Title: "${originalTitle}"`);
  console.log(`   Ship Name: "${shipName || 'NOT EXTRACTED'}"`);
  console.log(`   Ships Found: ${shipOptions.length}`);
  console.log(`   Ship Options: ${JSON.stringify(shipOptions)}`);
  console.log(`   Tours URL: ${absoluteToursUrl}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}
          clearTimeout(timeout);
          document.body.removeChild(iframe);
          resolve({
            url: url,
            originalTitle: originalTitle,
            shipName: shipName,
            toursUrl: absoluteToursUrl,
            pageTitle: pageTitle,
            shipOptions: shipOptions,
            available: shipAvailable,
            pageStatus: 'loaded',
            error: null
          });
          
        } catch (error) {
          clearTimeout(timeout);
          document.body.removeChild(iframe);
          resolve({
            url: url,
            originalTitle: originalTitle,
            shipName: shipName,
            toursUrl: absoluteToursUrl,
            available: false,
            pageStatus: 'loading_error',
            error: `Attempt ${attempt}: ${error.message}`
          });
        }
      };
      
      iframe.onload = () => {
        setTimeout(() => {
          try {
            const iframeDoc = iframe.contentWindow.document;
            
            if (!iframeDoc || !iframeDoc.body || iframeDoc.body.innerHTML.length < 100) {
              setTimeout(() => {
                try {
                  checkShipList(iframe.contentWindow.document);
                } catch (e) {
                  clearTimeout(timeout);
                  document.body.removeChild(iframe);
                  resolve({
                    url: url,
                    originalTitle: originalTitle,
                    shipName: shipName,
                    toursUrl: absoluteToursUrl,
                    available: false,
                    pageStatus: 'loading_error',
                    error: `Attempt ${attempt}: Tours page content not loaded properly`
                  });
                }
              }, 3000);
            } else {
              checkShipList(iframeDoc);
            }
          } catch (error) {
            clearTimeout(timeout);
            document.body.removeChild(iframe);
            resolve({
              url: url,
              originalTitle: originalTitle,
              shipName: shipName,
              toursUrl: absoluteToursUrl,
              available: false,
              pageStatus: 'loading_error',
              error: `Attempt ${attempt}: Error accessing tours page content`
            });
          }
        }, 2000);
      };
      
      iframe.onerror = (error) => {
        clearTimeout(timeout);
        document.body.removeChild(iframe);
        resolve({
          url: url,
          originalTitle: originalTitle,
          shipName: shipName,
          toursUrl: absoluteToursUrl,
          available: false,
          pageStatus: 'loading_error',
          error: `Attempt ${attempt}: Error loading tours page`
        });
      };
      
      iframe.src = absoluteToursUrl;
    });
  };
  
  return await retryWithMaintenanceDetection(checkShipAttempt);
}

async function checkCruiseAvailability(url, originalTitle) {
  return new Promise((resolve) => {
    // Create an iframe to load the content without navigating away
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none'; // Hide the iframe
    document.body.appendChild(iframe);
    
    // Convert URL to readable text for comparison
    const urlAsText = urlPathToReadableText(url);
    
    // Extract cruise ID if available
    let cruiseId = null;
    const cruiseIdMatch = url.match(/\/cruises\/(\d+)/);
    if (cruiseIdMatch && cruiseIdMatch[1]) {
      cruiseId = cruiseIdMatch[1];
    }
    
    // Set a longer timeout to handle cases where the page doesn't load
    const timeout = setTimeout(() => {
      document.body.removeChild(iframe);
      resolve({
        url: url,
        originalTitle: originalTitle,
        urlAsText: urlAsText,
        cruiseId: cruiseId,
        available: false,
        error: 'Timeout while loading page'
      });
    }, 30000); // Increased to 30 seconds timeout
    
    // Function to check if the page has fully loaded
    const checkPageReady = () => {
      try {
        const iframeDoc = iframe.contentWindow.document;
        
        // Check if the page has started loading
        if (!iframeDoc || !iframeDoc.body) {
          // Wait and try again
          setTimeout(checkPageReady, 500);
          return;
        }
        
        // Check for price element specifically
        const priceElement = iframeDoc.querySelector('.al-price-summary .al-amount');
        
        if (!priceElement) {
          // If we've been waiting a while but still no price element, check if page appears loaded
          const bodyContent = iframeDoc.body.innerHTML;
          
          // Look for elements that indicate the page is loaded but might not have price
          const hasMainContent = iframeDoc.querySelector('.al-main') || 
                                iframeDoc.querySelector('h1') || 
                                iframeDoc.querySelector('.al-contactbar');
          
          if (hasMainContent) {
            // Page seems to have loaded but no price element found
            // Try broader price selectors
            checkPrice(iframeDoc);
          } else {
            // Page still loading, check again after a short delay
            setTimeout(checkPageReady, 500);
          }
        } else {
          // Price element found, check the price
          checkPrice(iframeDoc);
        }
      } catch (error) {
        // Error accessing iframe content
        clearTimeout(timeout);
        document.body.removeChild(iframe);
        resolve({
          url: url,
          originalTitle: originalTitle,
          urlAsText: urlAsText,
          cruiseId: cruiseId,
          available: false,
          error: `Error checking page: ${error.message}`
        });
      }
    };
    
    // Function to check price once page is ready
    const checkPrice = (iframeDoc) => {
      try {
        // Try multiple selectors to find price
        const priceSelectors = [
          '.al-price-summary .al-amount',
          '.al-price .al-amount',
          '.al-price-min .al-amount',
          '[class*="price"] .al-amount',
          '.al-amount',
          '.cruise-price',
          '.price-value'
        ];
        
        let priceElement = null;
        let priceSelector = '';
        
        for (const selector of priceSelectors) {
          const element = iframeDoc.querySelector(selector);
          if (element) {
            priceElement = element;
            priceSelector = selector;
            break;
          }
        }
        
        let price = null;
        let priceText = null;
        
        if (priceElement) {
          priceText = priceElement.textContent.trim();
          // Extract numeric value
          const priceMatch = priceText.match(/[\d,]+/);
          if (priceMatch) {
            price = parseFloat(priceMatch[0].replace(/,/g, ''));
          }
        }
        
        // Log debug info
        console.log(`Checking cruise: ${url}`);
        console.log(`Price selector used: ${priceSelector}`);
        console.log(`Price text found: ${priceText}`);
        console.log(`Parsed price: ${price}`);
        
        // Get the page title
        const pageTitle = iframeDoc.querySelector('h1')?.textContent.trim() || 
                          iframeDoc.title || 
                          null;
        
        // Get other relevant details
        const departureInfo = iframeDoc.querySelector('.al-cruise-departure')?.textContent.trim() || null;
        const durationInfo = iframeDoc.querySelector('.al-cruise-duration')?.textContent.trim() || null;
        
        // Cruise is available if price exists and is greater than zero
        const available = price !== null && price > 0;
        // LOG UNAVAILABLE CRUISES
if (!available) {
  console.log(`❌ UNAVAILABLE CRUISE DETECTED:`);
  console.log(`   URL: ${url}`);
  console.log(`   Original Title: "${originalTitle}"`);
  console.log(`   Cruise ID: ${cruiseId}`);
  console.log(`   Price Text: "${priceText || 'NOT FOUND'}"`);
  console.log(`   Parsed Price: ${price}`);
  console.log(`   Page Title: "${pageTitle || 'NOT FOUND'}"`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}
        // Clean up and return result
        clearTimeout(timeout);
        document.body.removeChild(iframe);
        resolve({
          url: url,
          originalTitle: originalTitle,
          urlAsText: urlAsText,
          cruiseId: cruiseId,
          priceText: priceText,
          price: price,
          pageTitle: pageTitle,
          departureInfo: departureInfo,
          durationInfo: durationInfo,
          available: available,
          priceSelector: priceSelector,
          error: null
        });
      } catch (error) {
        // Handle any errors
        clearTimeout(timeout);
        document.body.removeChild(iframe);
        resolve({
          url: url,
          originalTitle: originalTitle,
          urlAsText: urlAsText,
          cruiseId: cruiseId,
          available: false,
          error: error.message
        });
      }
    };
    
    // Set up iframe load event
    iframe.onload = () => {
      // Start checking if the page is ready
      setTimeout(checkPageReady, 1000); // Give it a second after initial load event
    };
    
    // Handle iframe loading errors
    iframe.onerror = (error) => {
      clearTimeout(timeout);
      document.body.removeChild(iframe);
      resolve({
        url: url,
        originalTitle: originalTitle,
        urlAsText: urlAsText,
        cruiseId: cruiseId,
        available: false,
        error: 'Error loading page'
      });
    };
    
    // Set iframe source to load the page
    iframe.src = url;
  });
}

async function checkActivityAvailability(url, originalTitle, urlPattern) {
  const checkActivityAttempt = (attempt) => {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      
      let activityText = null;
      const toursMatch = url.match(/\/tours\/([^\/]+)\/?$/);
      if (toursMatch && toursMatch[1]) {
        activityText = toursMatch[1].replace(/-/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
      
      const urlAsText = urlPathToReadableText(url);
      
      const isDestination = urlPattern && (
        urlPattern.startsWith('multi-level/destination-') ||
        urlPattern === 'destination' || 
        urlPattern === 'destination/subdestination'
      );
      let destinationLevel = 1;
      if (urlPattern && urlPattern.startsWith('multi-level/destination-')) {
        const levelMatch = urlPattern.match(/destination-(\d+)/);
        if (levelMatch && levelMatch[1]) {
          destinationLevel = parseInt(levelMatch[1]);
        }
      }
      
      // ENHANCED DEBUGGING
      console.log(`🔍 DEBUGGING URL: ${url}`);
      console.log(`📍 Original Title: "${originalTitle}"`);
      console.log(`🏷️ URL Pattern: ${urlPattern}`);
      console.log(`🌍 Is Destination: ${isDestination}`);
      console.log(`📊 Destination Level: ${destinationLevel}`);
      
      const timeout = setTimeout(() => {
        console.log(`⏰ Attempt ${attempt}: Timeout reached for ${url}`);
        document.body.removeChild(iframe);
        resolve({
          url: url,
          originalTitle: originalTitle,
          urlAsText: urlAsText,
          activityText: activityText,
          destinationLevel: destinationLevel,
          available: false,
          pageStatus: 'timeout',
          error: `Attempt ${attempt}: Timeout while loading page`,
          debugInfo: { step: 'timeout', details: 'Page load timeout' }
        });
      }, 10000);
      
      const checkElements = (iframeDoc, httpResponse = null) => {
        try {
          const pageStatus = detectPageStatus(iframeDoc, httpResponse);
          
          if (pageStatus.status !== 'loaded') {
            console.log(`❌ Page status: ${pageStatus.status} - ${pageStatus.message}`);
            clearTimeout(timeout);
            document.body.removeChild(iframe);
            resolve({
              url: url,
              originalTitle: originalTitle,
              urlAsText: urlAsText,
              activityText: activityText,
              destinationLevel: destinationLevel,
              available: false,
              pageStatus: pageStatus.status,
              error: `Attempt ${attempt}: ${pageStatus.message}`,
              debugInfo: { step: 'page_status_check', details: pageStatus }
            });
            return;
          }
          
          console.log(`✅ Page loaded successfully for ${url}`);
          
          let experienceOptions = [];
          let activityOptions = [];
          let activityAvailable = null;
          let contactBarTitle = null;
          let userToolsInfo = null;
          let userToolsElement = null;
          
          // ENHANCED USER TOOLS INFO CHECKING WITH MULTIPLE SELECTORS
          const userToolsSelectors = [
            '.al-user-tools-info > div:first-child span',
            '.al-user-tools-info span',
            '.al-user-tools-info div span',
            '.al-user-tools-info > div:first-child',
            '.al-user-tools-info'
          ];
          if (isDestination) {
            
            
            console.log(`🎯 Checking destination with ${userToolsSelectors.length} selectors...`);
            
            for (const selector of userToolsSelectors) {
              userToolsElement = iframeDoc.querySelector(selector);
              if (userToolsElement) {
                userToolsInfo = userToolsElement.textContent.trim();
                console.log(`✅ Found user tools info with selector "${selector}": "${userToolsInfo}"`);
                break;
              } else {
                console.log(`❌ Selector "${selector}" not found`);
              }
            }
            
            if (!userToolsInfo) {
              console.log(`⚠️ No user tools info found, checking page structure...`);
              // Log what elements ARE available for debugging
              const userToolsContainer = iframeDoc.querySelector('.al-user-tools-info');
              if (userToolsContainer) {
                console.log(`📦 User tools container found, innerHTML: ${userToolsContainer.innerHTML.substring(0, 200)}...`);
              } else {
                console.log(`❌ No .al-user-tools-info container found at all`);
              }
            }
          }
          
          // EXPERIENCE AND ACTIVITY OPTIONS (for non-destination links)
          const experienceSelectors = [
            '.al-il-fields-experience ul',
            '.al-il-fields-experience',
            '[class*="experience"] ul',
            '.experience-list ul'
          ];
          
          let experienceList = null;
          for (const selector of experienceSelectors) {
            experienceList = iframeDoc.querySelector(selector);
            if (experienceList) break;
          }
          
          if (experienceList) {
            const experienceLabels = experienceList.querySelectorAll('li label, li, label');
            experienceLabels.forEach(label => {
              const text = label.textContent.trim();
              if (text) experienceOptions.push(text);
            });
            console.log(`🎯 Found ${experienceOptions.length} experience options`);
          }
          
          const activitySelectors = [
            '.al-il-fields-activity ul',
            '.al-il-fields-activity',
            '[class*="activity"] ul',
            '.activity-list ul'
          ];
          
          let activityList = null;
          for (const selector of activitySelectors) {
            activityList = iframeDoc.querySelector(selector);
            if (activityList) break;
          }
          
          if (activityList) {
            const activityLabels = activityList.querySelectorAll('li label, li, label');
            activityLabels.forEach(label => {
              const text = label.textContent.trim();
              if (text) activityOptions.push(text);
            });
            console.log(`🎯 Found ${activityOptions.length} activity options`);
          }
          
          // ACTIVITY AVAILABILITY CHECK
          if (activityText && (experienceOptions.length > 0 || activityOptions.length > 0)) {
            const activityExistsInExperience = experienceOptions.some(option => 
              textsMatch(option, activityText)
            );
            
            const activityExistsInActivity = activityOptions.some(option => 
              option.toLowerCase().includes(activityText.toLowerCase()) || 
              activityText.toLowerCase().includes(option.toLowerCase())
            );
            
            activityAvailable = activityExistsInExperience || activityExistsInActivity;
            console.log(`🎯 Activity "${activityText}" available: ${activityAvailable}`);
          }
          
          const pageTitle = iframeDoc.querySelector('h1')?.textContent.trim() || 
                            iframeDoc.title || 
                            null;
          
          console.log(`📄 Page title: "${pageTitle}"`);
          
          // ENHANCED AVAILABILITY LOGIC WITH FALLBACKS
          let available = false;
          let matchDetails = [];
          
          if (activityText && activityAvailable !== null) {
            available = activityAvailable;
            matchDetails.push(`Activity check: ${activityAvailable}`);
          } else if (isDestination) {
            console.log(`🔍 Checking destination availability...`);
            
            // Primary check: user tools info
            if (userToolsInfo) {
              const userToolsMatches = [
                originalTitle && textsMatch(userToolsInfo, originalTitle),
                textsMatch(userToolsInfo, urlAsText),
                pageTitle && textsMatch(userToolsInfo, pageTitle)
              ];
              
              console.log(`🔍 Text matching results:`);
              console.log(`  - User tools: "${userToolsInfo}"`);
              console.log(`  - Original title: "${originalTitle}" → Match: ${userToolsMatches[0]}`);
              console.log(`  - URL as text: "${urlAsText}" → Match: ${userToolsMatches[1]}`);
              console.log(`  - Page title: "${pageTitle}" → Match: ${userToolsMatches[2]}`);
              
              available = userToolsMatches.some(match => match);
              matchDetails.push(`User tools info check: ${available}`);
            } 
            
            // Fallback 1: Check page title directly
            if (!available && pageTitle) {
              const titleMatches = [
                originalTitle && textsMatch(pageTitle, originalTitle),
                textsMatch(pageTitle, urlAsText)
              ];
              
              available = titleMatches.some(match => match);
              if (available) {
                matchDetails.push(`Page title fallback: ${available}`);
                console.log(`✅ Fallback: Page title match found`);
              }
            }
            
            // Fallback 2: Check if page loaded successfully (basic availability)
            if (!available) {
              available = pageTitle && pageTitle.length > 0;
              if (available) {
                matchDetails.push(`Basic page load fallback: ${available}`);
                console.log(`⚠️ Fallback: Basic page availability (page loaded with title)`);
              }
            }
          }
          
          console.log(`🎯 Final availability result: ${available}`);
          // LOG UNAVAILABLE LINKS CLEARLY
if (!available) {
  console.log(`❌ UNAVAILABLE: ${url} | Title: "${originalTitle}" | Pattern: ${urlPattern} | UserTools: "${userToolsInfo || 'NOT FOUND'}" | PageTitle: "${pageTitle || 'NOT FOUND'}" | Matches: ${matchDetails.join(', ') || 'None'}`);
}
          console.log(`📝 Match details: ${matchDetails.join(', ')}`);
          


          clearTimeout(timeout);
          document.body.removeChild(iframe);
          resolve({
            url: url,
            originalTitle: originalTitle,
            urlAsText: urlAsText,
            activityText: activityText,
            contactBarTitle: contactBarTitle,
            userToolsInfo: userToolsInfo,
            pageTitle: pageTitle,
            experienceOptions: experienceOptions,
            activityOptions: activityOptions,
            destinationLevel: destinationLevel,
            checkMethod: isDestination ? 'user-tools-info' : 'activity-check',
            available: available,
            pageStatus: 'loaded',
            error: null,
            debugInfo: {
              step: 'completed',
              matchDetails: matchDetails,
              userToolsElement: userToolsElement ? userToolsElement.outerHTML : null,
              selectors_tried: isDestination ? userToolsSelectors : []
            }
          });
          
        } catch (error) {
          console.log(`❌ Error in checkElements: ${error.message}`);
          clearTimeout(timeout);
          document.body.removeChild(iframe);
          resolve({
            url: url,
            originalTitle: originalTitle,
            urlAsText: urlAsText,
            activityText: activityText,
            destinationLevel: destinationLevel,
            available: false,
            pageStatus: 'loading_error',
            error: `Attempt ${attempt}: ${error.message}`,
            debugInfo: { step: 'error', details: error.message }
          });
        }
      };
      
      iframe.onload = () => {
        setTimeout(() => {
          try {
            const iframeDoc = iframe.contentWindow.document;
            
            if (!iframeDoc || !iframeDoc.body || iframeDoc.body.innerHTML.length < 100) {
              setTimeout(() => {
                try {
                  checkElements(iframe.contentWindow.document);
                } catch (e) {
                  clearTimeout(timeout);
                  document.body.removeChild(iframe);
                  resolve({
                    url: url,
                    originalTitle: originalTitle,
                    urlAsText: urlAsText,
                    activityText: activityText,
                    destinationLevel: destinationLevel,
                    available: false,
                    pageStatus: 'loading_error',
                    error: `Attempt ${attempt}: Page content not loaded properly`,
                    debugInfo: { step: 'delayed_load_error', details: e.message }
                  });
                }
              }, 3000);
            } else {
              checkElements(iframeDoc);
            }
          } catch (error) {
            clearTimeout(timeout);
            document.body.removeChild(iframe);
            resolve({
              url: url,
              originalTitle: originalTitle,
              urlAsText: urlAsText,
              activityText: activityText,
              destinationLevel: destinationLevel,
              available: false,
              pageStatus: 'loading_error',
              error: `Attempt ${attempt}: Error accessing iframe content`,
              debugInfo: { step: 'iframe_access_error', details: error.message }
            });
          }
        }, 2000);
      };
      
      iframe.onerror = (error) => {
        console.log(`❌ Iframe error for ${url}: ${error}`);
        clearTimeout(timeout);
        document.body.removeChild(iframe);
        resolve({
          url: url,
          originalTitle: originalTitle,
          urlAsText: urlAsText,
          activityText: activityText,
          destinationLevel: destinationLevel,
          available: false,
          pageStatus: 'loading_error',
          error: `Attempt ${attempt}: Error loading page`,
          debugInfo: { step: 'iframe_error', details: error }
        });
      };
      
      iframe.src = url;
    });
  };
  
  return await retryWithMaintenanceDetection(checkActivityAttempt);
}

// Function to check multiple destination links
async function checkDestinationsAvailability(links, maxConcurrent = 3) {
  const results = [];
  const queue = [...links];
  const inProgress = [];
  
  // Status reporting
  let completed = 0;
  const total = queue.length;
  const startTime = Date.now();
  
  // Create status element for UI feedback
  const statusElement = document.createElement('div');
  statusElement.style.cssText = 'position: fixed; top: 10px; right: 10px; background: rgba(0,0,0,0.8); color: white; padding: 10px; border-radius: 5px; z-index: 9999; font-family: sans-serif;';
  document.body.appendChild(statusElement);
  
  // Update status display
  const updateStatus = () => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutesElapsed = Math.floor(elapsed / 60);
    const secondsElapsed = elapsed % 60;
    const timeString = `${minutesElapsed}m ${secondsElapsed}s`;
    
    // Calculate estimated time remaining
    let etaString = 'calculating...';
    if (completed > 5) { // Need some data to make a reasonable estimate
      const msPerItem = (Date.now() - startTime) / completed;
      const msRemaining = msPerItem * (total - completed);
      const secondsRemaining = Math.floor(msRemaining / 1000);
      const minutesRemaining = Math.floor(secondsRemaining / 60);
      const secondsRemainingMod = secondsRemaining % 60;
      etaString = `~${minutesRemaining}m ${secondsRemainingMod}s`;
    }
    
    statusElement.innerHTML = `Checking links: ${completed}/${total} (${Math.floor(completed/total*100)}%)<br>
                              Time elapsed: ${timeString}<br>
                              Est. remaining: ${etaString}`;
  };
  
  updateStatus();
  
  // Function to process next item in queue
  const processNext = async () => {
    if (queue.length === 0) return;
    
    const item = queue.shift();
    inProgress.push(item);
    
    try {
      // Get the absolute URL
      const baseUrl = window.location.origin;
      const absoluteUrl = item.href.startsWith('http') ? 
                          item.href : 
                          `${baseUrl}${item.href.startsWith('/') ? '' : '/'}${item.href}`;
      
      // Check availability based on URL pattern - FIXED pattern handling
      let result;
      // SKIP special destination pages immediately
      if (item.urlPattern === 'destination-special-page') {
        result = {
          url: item.href,
          originalTitle: item.text,
          available: null,
          error: 'Special destination page - automatically skipped',
          skipped: true,
          specialPageType: item.href.split('/').pop() // gets 'tours', 'cruises', etc.
        };
      }

      else if (item.urlPattern === 'tour-with-id') {
        // For tour URLs with ID, use the tour check
        result = await checkTourAvailability(absoluteUrl, item.text);
      }
      else if (item.urlPattern === 'cruise-ship') {
        // For cruise ship URLs, use the ship availability check
        result = await checkCruiseShipAvailability(absoluteUrl, item.text);
      }
      else if (item.urlPattern === 'cruise-with-id') {
        // For destination cruise URLs with ID, use the cruise check
        result = await checkCruiseAvailability(absoluteUrl, item.text);
      }
      else if (item.urlPattern === 'tour-activity') {
        // For activity URLs, use the activity check
        result = await checkActivityAvailability(absoluteUrl, item.text, item.urlPattern);
      }
      // Check for destination URLs (including multi-level) - UPDATED to pass urlPattern
      else if ((item.urlPattern === 'destination' || 
                item.urlPattern === 'destination/subdestination' ||
                item.urlPattern.startsWith('multi-level/destination-')) && 
                isTrueDestination(item.href, item.urlPattern)) {
        // For true destination URLs, use the availability check with urlPattern
        result = await checkActivityAvailability(absoluteUrl, item.text, item.urlPattern);
      }
      // Handle Table section links that aren't specifically categorized
      else if (item.section === 'Table') {
        // For Table section links, determine by URL content
        if (item.href.match(/^\/cruises\/\d+/) || item.href.includes('/cruises/') && item.href.match(/cruises\/\d+/)) {
          // Check if it's a cruise ship or destination cruise
          if (item.urlPattern === 'cruise-ship') {
            result = await checkCruiseShipAvailability(absoluteUrl, item.text);
          } else {
            result = await checkCruiseAvailability(absoluteUrl, item.text);
          }
        } else if (item.href.includes('/tours/') && item.href.match(/\/tours\/\d+/)) {
          result = await checkTourAvailability(absoluteUrl, item.text);
        } else {
          // Default to activity check for other table links
          result = await checkActivityAvailability(absoluteUrl, item.text, item.urlPattern);
        }
      }
      // Skip other URL patterns
      else {
        result = {
          url: item.href,
          originalTitle: item.text,
          available: null,
          error: 'Not a checkable link pattern',
          skipped: true
        };
      }
      
      // Add the result
      results.push({
        ...item,
        checkResult: result
      });
    } catch (error) {
      // Handle errors
      results.push({
        ...item,
        checkResult: {
          url: item.href,
          originalTitle: item.text,
          available: false,
          error: error.message
        }
      });
    }
    
    // Update progress and status
    completed++;
    updateStatus();
    
    // Remove from in-progress list
    const index = inProgress.indexOf(item);
    if (index > -1) {
      inProgress.splice(index, 1);
    }
    
    // Start next item if queue is not empty
    if (queue.length > 0) {
      processNext();
    }
  };
  
  // Start initial batch of requests
  const initialBatch = Math.min(maxConcurrent, queue.length);
  for (let i = 0; i < initialBatch; i++) {
    processNext();
  }
  
  // Wait until all requests are complete
  while (inProgress.length > 0 || queue.length > 0) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Remove status element when done
  document.body.removeChild(statusElement);
  
  return results;
}

// Helper function to get a readable link type name
function getReadableLinkType(urlPattern) {
  // Simplified pattern handling
  if (urlPattern === 'tour-with-id') return 'Tour';
  if (urlPattern === 'cruise-ship') return 'Cruise Ship';
  if (urlPattern === 'cruise-with-id') return 'Cruise';
  if (urlPattern === 'operator-with-id') return 'Operator';
  if (urlPattern === 'tour-activity') return 'Activity';
  if (urlPattern === 'tours-category') return 'Tours';
  if (urlPattern === 'cruises-category') return 'Cruises';
  if (urlPattern === 'destination-special-page') return 'Special Destination Page';
  
  // FLEXIBLE: Handle multi-level patterns
  if (urlPattern.startsWith('multi-level/destination-')) {
    const level = urlPattern.split('-')[1];
    return level === '1' ? 'Destination' : 'Subdestination';
  }
  
  if (urlPattern.includes('/articles')) return 'Article';
  if (urlPattern.includes('/stories')) return 'Story';
  if (urlPattern.includes('/deals')) return 'Deal';
  
  // Legacy and other patterns
  return urlPattern.split('/').pop() || 'Unknown';
}

// Modified enhancedLinkExtractor to include destination availability checking
async function enhancedLinkExtractorWithAvailabilityCheck(checkAvailability = false) {
  const mainElement = document.querySelector('.al-main, [id="al-main"]');
  if (!mainElement) {
    console.error('Cannot find .al-main element on this page');
    return null;
  }

  // Find all sections with class starting with al-sec-
  const sections = mainElement.querySelectorAll('[class*="al-sec-"]');
  const result = {
    summary: {
      totalLinks: 0,
      sectionTypes: {},
      urlPatterns: {}
    },
    sections: {},
    urlPatterns: {}
  };

  // Extract section types and create a map
  const sectionTypeMap = {};
  let allLinks = [];
  
  sections.forEach(section => {
    const classes = Array.from(section.classList);
    let sectionType = null;
    
    // Find the class that starts with al-sec-
    for (const className of classes) {
      if (className.startsWith('al-sec-') && className !== 'al-sec-title' && className !== 'al-sec-content') {
        sectionType = className.replace('al-sec-', '');
        break;
      }
    }
    
    if (sectionType) {
      // Get section title if available
      let sectionTitle = '';
      const sectionTitleElement = section.querySelector('.al-sec-title h2');
      if (sectionTitleElement) {
        sectionTitle = sectionTitleElement.textContent.trim();
      }
      
      // Create a readable section type name
      const readableSectionType = sectionType.charAt(0).toUpperCase() + sectionType.slice(1);
      
      // Initialize section in results if needed
      if (!result.sections[readableSectionType]) {
        result.sections[readableSectionType] = [];
        result.summary.sectionTypes[readableSectionType] = 0;
      }
      
      // Extract links from this section
      const links = extractLinksFromElement(section);
      
      if (links.length > 0) {
        // Add section info to each link
        const linksWithSection = links.map(link => ({
          ...link,
          section: readableSectionType,
          sectionTitle: sectionTitle || `${readableSectionType} Section`
        }));
        
        // Add all links to our global list
        allLinks = [...allLinks, ...linksWithSection];
        
        // Add section to results
        result.sections[readableSectionType].push({
          title: sectionTitle || `${readableSectionType} Section`,
          links: links
        });
        
        // Update section type counts
        result.summary.totalLinks += links.length;
        result.summary.sectionTypes[readableSectionType] += links.length;
        
        // Update URL pattern counts and organize by URL pattern
        links.forEach(link => {
          const pattern = link.urlPattern;
          
          // Initialize URL pattern in summary if needed
          if (!result.summary.urlPatterns[pattern]) {
            result.summary.urlPatterns[pattern] = 0;
          }
          
          // Initialize URL pattern in results if needed
          if (!result.urlPatterns[pattern]) {
            result.urlPatterns[pattern] = [];
          }
          
          // Update URL pattern count
          result.summary.urlPatterns[pattern]++;
          
          // Add link to URL patterns section
          result.urlPatterns[pattern].push({
            section: readableSectionType,
            sectionTitle: sectionTitle || `${readableSectionType} Section`,
            text: link.text,
            href: link.href
          });
        });
      }
    }
  });

  // Check destination availability if requested
  if (checkAvailability) {
    console.log('Checking link availability, this may take a while...');
    
    const linksToCheck = allLinks.filter(link => {
  // Always include links from table sections
  if (link.section === 'Table') {
    return true;
  }
  
  // SKIP special destination pages
  if (link.urlPattern === 'destination-special-page') {
    return true; // Include them so they can be marked as skipped with proper reason
  }
  
  // Simplified pattern checking
  if (link.urlPattern === 'tour-with-id' || 
      link.urlPattern === 'cruise-ship' ||
      link.urlPattern === 'cruise-with-id' ||
      link.urlPattern === 'tour-activity' ||
      link.urlPattern === 'tours-category' ||
      link.urlPattern === 'cruises-category' ||
      link.urlPattern === 'operator-with-id') {
    return true;
  }
  
  // FLEXIBLE: Check multi-level destinations
  if (link.urlPattern.startsWith('multi-level/destination-') &&
      isTrueDestination(link.href, link.urlPattern)) {
    return true;
  }
  
  // Legacy destination patterns
  if ((link.urlPattern === 'destination' || link.urlPattern === 'destination/subdestination') &&
      isTrueDestination(link.href, link.urlPattern)) {
    return true;
  }
  
  // FLEXIBLE: Include all content patterns so they can be properly marked as skipped
  if (link.urlPattern.includes('/articles') ||
      link.urlPattern.includes('/stories') ||
      link.urlPattern.includes('/deals')) {
    return true;
  }
  
  return false;
});
    
    // Count links by type for the confirmation dialog
    const tourCount = linksToCheck.filter(l => 
      l.urlPattern === 'tour-with-id' || l.href.includes('/tours/')
    ).length;
    
    const cruiseShipCount = linksToCheck.filter(l => 
      l.urlPattern === 'cruise-ship'
    ).length;
    
    const cruiseCount = linksToCheck.filter(l => 
      l.urlPattern === 'cruise-with-id'
    ).length;
    
    const destCount = linksToCheck.filter(l => 
      (l.urlPattern === 'destination' || l.urlPattern === 'destination/subdestination') &&
      isTrueDestination(l.href, l.urlPattern)
    ).length;
    
    const multiLevelDestCount = linksToCheck.filter(l => 
      l.urlPattern.startsWith('multi-level/destination-') &&
      isTrueDestination(l.href, l.urlPattern)
    ).length;
    
    const activityCount = linksToCheck.filter(l => 
      l.urlPattern === 'tour-activity'
    ).length;
    
    // Count special destination pages that will be skipped
    const specialDestinationCount = linksToCheck.filter(l => 
      l.urlPattern === 'destination-special-page'
    ).length;
    
    // Count table section links
    const tableCount = linksToCheck.filter(l => l.section === 'Table').length;
    
    if (linksToCheck.length > 0) {
      // Show a confirmation dialog with the number of links to check
      const confirmCheck = confirm(
        `This will check availability for ${linksToCheck.length} links:\n` +
        `- ${destCount + multiLevelDestCount} destination links (all levels - user-tools-info check)\n` +
        `- ${tourCount} tour links\n` +
        `- ${cruiseShipCount} cruise ship links (ship list check)\n` +
        `- ${cruiseCount} cruise links (price check)\n` +
        `- ${activityCount} activity links\n` +
        `- ${tableCount} table links\n` +
        `- ${specialDestinationCount} special destination pages (will be skipped: /land-tours, /ships, /videos, /myTrips, /articles)\n\n` +
        `This process may take several minutes and open multiple iframes.\n\n` +
        `Do you want to continue?`
      );
      
      if (confirmCheck) {
        // Check availability of links
        const checkedLinks = await checkDestinationsAvailability(linksToCheck);
        
        // Add availability information to results
        result.availability = {
          checkedLinks: checkedLinks.length,
          available: checkedLinks.filter(link => link.checkResult.available).length,
          unavailable: checkedLinks.filter(link => link.checkResult.available === false).length,
          unknown: checkedLinks.filter(link => link.checkResult.available === null).length,
          details: checkedLinks
        };
      }
    } else {
      console.log('No links found to check.');
    }
  }

  // Print the summary in a readable format
  console.log('=== LINK EXTRACTION RESULTS ===');
  console.log(`Total links found: ${result.summary.totalLinks}`);
  
  console.log('\nLinks by section type:');
  Object.keys(result.summary.sectionTypes).forEach(sectionType => {
    console.log(`- ${sectionType}: ${result.summary.sectionTypes[sectionType]} links`);
  });
  
  console.log('\nLinks by URL pattern:');
  Object.keys(result.summary.urlPatterns).forEach(pattern => {
    console.log(`- ${pattern}: ${result.summary.urlPatterns[pattern]} links`);
  });
  
  // Print availability results if checked
  if (result.availability) {
    console.log('\n=== AVAILABILITY RESULTS ===');
    console.log(`Checked ${result.availability.checkedLinks} links:`);
    console.log(`- Available: ${result.availability.available}`);
    console.log(`- Unavailable: ${result.availability.unavailable}`);
    console.log(`- Unknown/Skipped: ${result.availability.unknown}`);
  }

  return result;
}

// Function to update the section filter dropdown with all section types
function updateSectionFilterDropdown(relevantResults, skippedResults) {
  const sectionTypes = new Set();
  
  // Add sections from relevant results
  relevantResults.forEach(link => {
    if (link.section) {
      sectionTypes.add(link.section);
    }
  });
  
  // Also add sections from skipped results
  skippedResults.forEach(link => {
    if (link.section) {
      sectionTypes.add(link.section);
    }
  });
  
  // Create the options HTML
  let optionsHtml = '<option value="all">All Section Types</option>';
  Array.from(sectionTypes).sort().forEach(section => {
    optionsHtml += `<option value="${section}">${section}</option>`;
  });
  
  return optionsHtml;
}

// Helper function to generate code for HTML table output including availability
function generateHtmlTable(data) {
  // Create table for URL patterns
  let html = '<h2>Links Organized by URL Pattern</h2>';
  html += '<table border="1" style="border-collapse: collapse; width: 100%;">';
  html += '<thead style="background-color: #f2f2f2;"><tr><th>#</th><th>URL Pattern</th><th>Count</th><th>Example URLs</th></tr></thead>';
  html += '<tbody>';
  
  Object.keys(data.summary.urlPatterns).sort().forEach((pattern, index) => {
    const count = data.summary.urlPatterns[pattern];
    const examples = data.urlPatterns[pattern].slice(0, 3).map(link => link.href);
    
    html += '<tr>';
    html += `<td style="padding: 8px; text-align: center;">${index + 1}</td>`;
    html += `<td style="padding: 8px;"><strong>${pattern}</strong></td>`;
    html += `<td style="padding: 8px; text-align: center;">${count}</td>`;
    html += `<td style="padding: 8px; font-family: monospace;">${examples.join('<br>')}</td>`;
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  
  // Create table for section types
  html += '<h2>Links Organized by Section Type</h2>';
  html += '<table border="1" style="border-collapse: collapse; width: 100%;">';
  html += '<thead style="background-color: #f2f2f2;"><tr><th>#</th><th>Section Type</th><th>Count</th><th>Section Titles</th></tr></thead>';
  html += '<tbody>';
  
  Object.keys(data.summary.sectionTypes).sort().forEach((section, index) => {
    const count = data.summary.sectionTypes[section];
    const titles = data.sections[section].map(sec => sec.title);
    
    html += '<tr>';
    html += `<td style="padding: 8px; text-align: center;">${index + 1}</td>`;
    html += `<td style="padding: 8px;"><strong>${section}</strong></td>`;
    html += `<td style="padding: 8px; text-align: center;">${count}</td>`;
    html += `<td style="padding: 8px;">${titles.join('<br>')}</td>`;
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  
  // If we have availability data, add that table
  if (data.availability) {
    html += '<h2>Link Availability Check Results</h2>';
    html += '<div style="margin-bottom: 10px;">';
    html += `<strong>Summary:</strong> Checked ${data.availability.checkedLinks} links - `;
    html += `<span style="color: green;">${data.availability.available} available</span>, `;
    html += `<span style="color: red;">${data.availability.unavailable} unavailable</span>, `;
    html += `<span style="color: gray;">${data.availability.unknown} unknown/skipped</span>`;
    html += '</div>';
    
    // Filter out skipped links for cleaner results, but show special destination pages in skipped tab
    const relevantResults = data.availability.details.filter(link => 
      !link.checkResult.skipped || link.urlPattern === 'destination-special-page'
    );
    const skippedResults = data.availability.details.filter(link => 
      link.checkResult.skipped && link.urlPattern !== 'destination-special-page'
    );
    const specialDestinationResults = data.availability.details.filter(link => 
      link.urlPattern === 'destination-special-page'
    );
    
    // Create tabs for different link types and section filters
    html += '<div class="tab-container" style="margin-bottom: 20px;">';
    
    // Link Type filter tabs
    html += '<div class="tab-buttons" style="margin-bottom: 10px;">';
    html += '<span style="font-weight: bold; margin-right: 10px;">Filter by Link Type:</span>';
    html += '<button class="tab-button active" data-tab="all" style="padding: 8px 12px; margin-right: 5px; cursor: pointer; background-color: #f0f0f0; border: 1px solid #ccc; border-radius: 3px;">All Checked Links</button>';
    html += '<button class="tab-button" data-tab="destinations" style="padding: 8px 12px; margin-right: 5px; cursor: pointer; background-color: #f0f0f0; border: 1px solid #ccc; border-radius: 3px;">Destinations</button>';
    html += '<button class="tab-button" data-tab="tours" style="padding: 8px 12px; margin-right: 5px; cursor: pointer; background-color: #f0f0f0; border: 1px solid #ccc; border-radius: 3px;">Tours</button>';
    html += '<button class="tab-button" data-tab="cruise-ships" style="padding: 8px 12px; margin-right: 5px; cursor: pointer; background-color: #f0f0f0; border: 1px solid #ccc; border-radius: 3px;">Cruise Ships</button>';
    html += '<button class="tab-button" data-tab="cruises" style="padding: 8px 12px; margin-right: 5px; cursor: pointer; background-color: #f0f0f0; border: 1px solid #ccc; border-radius: 3px;">Cruises</button>';
    html += '<button class="tab-button" data-tab="activities" style="padding: 8px 12px; margin-right: 5px; cursor: pointer; background-color: #f0f0f0; border: 1px solid #ccc; border-radius: 3px;">Activities</button>';
    if (specialDestinationResults.length > 0) {
      html += '<button class="tab-button" data-tab="special-destinations" style="padding: 8px 12px; margin-right: 5px; cursor: pointer; background-color: #f0f0f0; border: 1px solid #ccc; border-radius: 3px;">Special Destination Pages</button>';
    }
    html += '<button class="tab-button" data-tab="skipped" style="padding: 8px 12px; margin-right: 5px; cursor: pointer; background-color: #f0f0f0; border: 1px solid #ccc; border-radius: 3px;">Skipped Links</button>';
    html += '</div>';
    
    // Filters container
html += '<div class="filter-container" style="margin-bottom: 15px; display: flex; flex-wrap: wrap; gap: 20px; align-items: center;">';

// Section Type filter
html += '<div class="section-filter">';
html += '<span style="font-weight: bold; margin-right: 10px;">Filter by Section:</span>';
html += '<select id="section-type-filter" style="padding: 8px; border-radius: 3px; border: 1px solid #ccc;">';
html += updateSectionFilterDropdown(relevantResults, skippedResults);
html += '</select>';
html += '</div>';

// Availability status filter
html += '<div class="availability-filter">';
html += '<span style="font-weight: bold; margin-right: 10px;">Filter by Status:</span>';
html += '<select id="availability-status-filter" style="padding: 8px; border-radius: 3px; border: 1px solid #ccc;">';
html += '<option value="all">All Status</option>';
html += '<option value="available">Available Only</option>';
html += '<option value="unavailable">Unavailable Only</option>';
html += '<option value="broken">Broken Links (404)</option>';
html += '<option value="maintenance">Under Maintenance</option>';
html += '<option value="timeout">Timeout</option>';
html += '<option value="unknown">Unknown/Skipped</option>';
html += '</select>';
html += '</div>';

html += '</div>'; // End filter container
    
    // All links tab (excluding special destination pages from the main view)
    html += '<div class="tab-content active" id="tab-all">';
    html += '<table border="1" style="border-collapse: collapse; width: 100%;" class="filterable-table">';
    html += '<thead style="background-color: #f2f2f2;"><tr>' + 
            '<th>#</th>' +
            '<th>Link Type</th>' + 
            '<th>Text</th>' + 
            '<th>URL</th>' + 
            '<th>Section</th>' + 
            '<th>Available</th>' + 
            '<th>Details</th>' +
            '</tr></thead>';
    html += '<tbody>';
    
    const allLinksExcludingSpecial = relevantResults.filter(link => 
      link.urlPattern !== 'destination-special-page'
    );
    
    allLinksExcludingSpecial.forEach((link, index) => {
      const result = link.checkResult;
      
      // Determine availability color and text based on final status
      let availabilityColor, availabilityText;
      
      if (result.finalStatus === 'broken_link_404') {
        availabilityColor = 'purple';
        availabilityText = 'Broken 404';
      } else if (result.finalStatus === 'under_maintenance') {
        availabilityColor = 'orange';
        availabilityText = 'Maintenance';
      } else if (result.finalStatus === 'timeout') {
        availabilityColor = 'gray';
        availabilityText = 'Timeout';
      } else if (result.available) {
        availabilityColor = 'green';
        availabilityText = 'Yes';
      } else if (result.available === false) {
        availabilityColor = 'red';
        availabilityText = 'No';
      } else {
        availabilityColor = 'gray';
        availabilityText = 'Unknown';
      }
      
      html += `<tr data-section="${link.section || ''}">`;
      html += `<td style="padding: 8px; text-align: center;">${index + 1}</td>`;
      html += `<td style="padding: 8px;">${getReadableLinkType(link.urlPattern)}</td>`;
      html += `<td style="padding: 8px;"><strong>${link.text}</strong></td>`;
      html += `<td style="padding: 8px; font-family: monospace;"><a href="${link.href}" target="_blank">${link.href}</a></td>`;
      html += `<td style="padding: 8px;">${link.section || ''}</td>`;
      html += `<td style="padding: 8px; color: ${availabilityColor}; text-align: center;"><strong>${availabilityText}</strong></td>`;
      
      // Different details based on link type
      html += '<td style="padding: 8px;">';
      if (link.urlPattern === 'tour-with-id') {
        html += `Tour ID: <strong>${result.tourId || '-'}</strong><br>`;
        if (result.finalStatus === 'broken_link_404') {
          html += `<span style="color: red;">Broken Link 404 - Page not found</span>`;
        } else if (result.finalStatus === 'under_maintenance') {
          html += `<span style="color: orange;">Under maintenance (tried ${result.retryAttempts || 1} times)</span>`;
        } else if (result.finalStatus === 'timeout') {
          html += `<span style="color: gray;">Timeout after ${result.retryAttempts || 1} attempts</span>`;
        } else {
          html += `Price: <strong>${result.priceText || 'Not found'}</strong><br>`;
          html += `${result.departureInfo || ''} ${result.durationInfo || ''}`;
        }
      } else if (link.urlPattern === 'cruise-ship') {
        html += `Ship: <strong>${result.shipName || '-'}</strong><br>`;
        if (result.finalStatus === 'broken_link_404') {
          html += `<span style="color: red;">Broken Link 404 - Page not found</span>`;
        } else if (result.finalStatus === 'under_maintenance') {
          html += `<span style="color: orange;">Tours page under maintenance (tried ${result.retryAttempts || 1} times)</span>`;
        } else if (result.finalStatus === 'timeout') {
          html += `<span style="color: gray;">Tours page timeout after ${result.retryAttempts || 1} attempts</span>`;
        } else {
          html += `Tours Page: <a href="${result.toursUrl}" target="_blank">Check Tours</a><br>`;
          html += `Ships Available: ${result.shipOptions ? result.shipOptions.length : '0'}`;
        }
      } else if (link.urlPattern === 'cruise-with-id') {
        html += `Cruise ID: <strong>${result.cruiseId || '-'}</strong><br>`;
        if (result.finalStatus === 'broken_link_404') {
          html += `<span style="color: red;">Broken Link 404 - Page not found</span>`;
        } else if (result.finalStatus === 'under_maintenance') {
          html += `<span style="color: orange;">Under maintenance (tried ${result.retryAttempts || 1} times)</span>`;
        } else if (result.finalStatus === 'timeout') {
          html += `<span style="color: gray;">Timeout after ${result.retryAttempts || 1} attempts</span>`;
        } else {
          html += `Price: <strong>${result.priceText || 'Not found'}</strong><br>`;
          html += `${result.departureInfo || ''} ${result.durationInfo || ''}`;
        }
      } else if (link.urlPattern === 'tour-activity' || link.urlPattern === 'destination/tours/activity') {
        html += `Activity: <strong>${result.activityText || '-'}</strong><br>`;
        if (result.finalStatus === 'broken_link_404') {
          html += `<span style="color: red;">Broken Link 404 - Page not found</span>`;
        } else if (result.finalStatus === 'under_maintenance') {
          html += `<span style="color: orange;">Under maintenance (tried ${result.retryAttempts || 1} times)</span>`;
        } else if (result.finalStatus === 'timeout') {
          html += `<span style="color: gray;">Timeout after ${result.retryAttempts || 1} attempts</span>`;
        } else {
          html += `Experience options: ${result.experienceOptions ? result.experienceOptions.length : '0'}<br>`;
          html += `Activity options: ${result.activityOptions ? result.activityOptions.length : '0'}`;
        }
      } else {
        // For destinations, show user tools info
        html += `URL as Text: <strong>${result.urlAsText || '-'}</strong><br>`;
        html += `Level: ${result.destinationLevel || '1'}<br>`;
        html += `Check Method: ${result.checkMethod || 'user-tools-info'}<br>`;
        if (result.finalStatus === 'broken_link_404') {
          html += `<span style="color: red;">Broken Link 404 - Page not found</span>`;
        } else if (result.finalStatus === 'under_maintenance') {
          html += `<span style="color: orange;">Under maintenance (tried ${result.retryAttempts || 1} times)</span>`;
        } else if (result.finalStatus === 'timeout') {
          html += `<span style="color: gray;">Timeout after ${result.retryAttempts || 1} attempts</span>`;
        } else {
          html += `User Tools Info: <strong>${result.userToolsInfo || 'Not found'}</strong><br>`;
          html += `Page Title: ${result.pageTitle || '-'}`;
        }
      }
      html += '</td>';
      
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    html += '</div>'; // End all tab
    
    // Destinations tab
    html += '<div class="tab-content" id="tab-destinations" style="display: none;">';
    html += '<table border="1" style="border-collapse: collapse; width: 100%;" class="filterable-table">';
    html += '<thead style="background-color: #f2f2f2;"><tr>' + 
            '<th>#</th>' +
            '<th>Destination</th>' + 
            '<th>URL</th>' + 
            '<th>Level</th>' + 
            '<th>Check Method</th>' + 
            '<th>Section</th>' +
            '<th>Available</th>' + 
            '<th>Details</th>' +
            '</tr></thead>';
    html += '<tbody>';
    
    const destinationLinks = relevantResults.filter(link => 
      link.urlPattern === 'destination' || 
      link.urlPattern === 'destination/subdestination' ||
      link.urlPattern.startsWith('multi-level/destination-')
    );
    
    destinationLinks.forEach((link, index) => {
      const result = link.checkResult;
      
      // Determine availability color and text based on final status
      let availabilityColor, availabilityText;
      
      if (result.finalStatus === 'broken_link_404') {
        availabilityColor = 'purple';
        availabilityText = 'Broken 404';
      } else if (result.finalStatus === 'under_maintenance') {
        availabilityColor = 'orange';
        availabilityText = 'Maintenance';
      } else if (result.finalStatus === 'timeout') {
        availabilityColor = 'gray';
        availabilityText = 'Timeout';
      } else if (result.available) {
        availabilityColor = 'green';
        availabilityText = 'Yes';
      } else if (result.available === false) {
        availabilityColor = 'red';
        availabilityText = 'No';
      } else {
        availabilityColor = 'gray';
        availabilityText = 'Unknown';
      }
      
// Continuation of the generateHtmlTable function and remaining functions

      html += `<tr data-section="${link.section || ''}">`;
      html += `<td style="padding: 8px; text-align: center;">${index + 1}</td>`;
      html += `<td style="padding: 8px;"><strong>${link.text}</strong></td>`;
      html += `<td style="padding: 8px; font-family: monospace;"><a href="${link.href}" target="_blank">${link.href}</a></td>`;
      html += `<td style="padding: 8px; text-align: center;">${result.destinationLevel || '1'}</td>`;
      html += `<td style="padding: 8px;">${result.checkMethod || 'user-tools-info'}</td>`;
      html += `<td style="padding: 8px;">${link.section || ''}</td>`;
      html += `<td style="padding: 8px; color: ${availabilityColor}; text-align: center;"><strong>${availabilityText}</strong></td>`;
      
      // For destinations, show user tools info for all levels
      html += '<td style="padding: 8px;">';
      html += `User Tools Info: <strong>${result.userToolsInfo || 'Not found'}</strong><br>`;
      html += `Page Title: ${result.pageTitle || '-'}<br>`;
      html += `URL as Text: ${result.urlAsText || '-'}`;
      html += '</td>';
      
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    html += '</div>'; // End destinations tab
    
    // Tours tab
    html += '<div class="tab-content" id="tab-tours" style="display: none;">';
    html += '<table border="1" style="border-collapse: collapse; width: 100%;" class="filterable-table">';
    html += '<thead style="background-color: #f2f2f2;"><tr>' + 
            '<th>#</th>' +
            '<th>Tour</th>' + 
            '<th>URL</th>' + 
            '<th>ID</th>' + 
            '<th>Section</th>' +
            '<th>Available</th>' + 
            '<th>Price</th>' +
            '<th>Details</th>' +
            '</tr></thead>';
    html += '<tbody>';
    
    const tourLinks = relevantResults.filter(link => 
      link.urlPattern === 'tour-with-id'
    );
    
    tourLinks.forEach((link, index) => {
      const result = link.checkResult;
      
      // Determine availability color and text based on final status
      let availabilityColor, availabilityText;
      
      if (result.finalStatus === 'broken_link_404') {
        availabilityColor = 'purple';
        availabilityText = 'Broken 404';
      } else if (result.finalStatus === 'under_maintenance') {
        availabilityColor = 'orange';
        availabilityText = 'Maintenance';
      } else if (result.finalStatus === 'timeout') {
        availabilityColor = 'gray';
        availabilityText = 'Timeout';
      } else if (result.available) {
        availabilityColor = 'green';
        availabilityText = 'Yes';
      } else if (result.available === false) {
        availabilityColor = 'red';
        availabilityText = 'No';
      } else {
        availabilityColor = 'gray';
        availabilityText = 'Unknown';
      }
      
      html += `<tr data-section="${link.section || ''}">`;
      html += `<td style="padding: 8px; text-align: center;">${index + 1}</td>`;
      html += `<td style="padding: 8px;"><strong>${link.text}</strong></td>`;
      html += `<td style="padding: 8px; font-family: monospace;"><a href="${link.href}" target="_blank">${link.href}</a></td>`;
      html += `<td style="padding: 8px; text-align: center;">${result.tourId || '-'}</td>`;
      html += `<td style="padding: 8px;">${link.section || ''}</td>`;
      html += `<td style="padding: 8px; color: ${availabilityColor}; text-align: center;"><strong>${availabilityText}</strong></td>`;
      html += `<td style="padding: 8px;">${result.priceText || 'Not found'}</td>`;
      html += `<td style="padding: 8px;">${result.pageTitle || '-'}<br>${result.departureInfo || ''} ${result.durationInfo || ''}</td>`;
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    html += '</div>'; // End tours tab
    
    // Cruise Ships tab
    html += '<div class="tab-content" id="tab-cruise-ships" style="display: none;">';
    html += '<table border="1" style="border-collapse: collapse; width: 100%;" class="filterable-table">';
    html += '<thead style="background-color: #f2f2f2;"><tr>' + 
            '<th>#</th>' +
            '<th>Cruise Ship</th>' + 
            '<th>URL</th>' + 
            '<th>Ship Name</th>' + 
            '<th>Section</th>' +
            '<th>Available</th>' + 
            '<th>Ships Found</th>' +
            '<th>Details</th>' +
            '</tr></thead>';
    html += '<tbody>';
    
    const cruiseShipLinks = relevantResults.filter(link => 
      link.urlPattern === 'cruise-ship'
    );
    
    cruiseShipLinks.forEach((link, index) => {
      const result = link.checkResult;
      
      // Determine availability color and text based on final status
      let availabilityColor, availabilityText;
      
      if (result.finalStatus === 'broken_link_404') {
        availabilityColor = 'purple';
        availabilityText = 'Broken 404';
      } else if (result.finalStatus === 'under_maintenance') {
        availabilityColor = 'orange';
        availabilityText = 'Maintenance';
      } else if (result.finalStatus === 'timeout') {
        availabilityColor = 'gray';
        availabilityText = 'Timeout';
      } else if (result.available) {
        availabilityColor = 'green';
        availabilityText = 'Yes';
      } else if (result.available === false) {
        availabilityColor = 'red';
        availabilityText = 'No';
      } else {
        availabilityColor = 'gray';
        availabilityText = 'Unknown';
      }
      
      html += `<tr data-section="${link.section || ''}">`;
      html += `<td style="padding: 8px; text-align: center;">${index + 1}</td>`;
      html += `<td style="padding: 8px;"><strong>${link.text}</strong></td>`;
      html += `<td style="padding: 8px; font-family: monospace;"><a href="${link.href}" target="_blank">${link.href}</a></td>`;
      html += `<td style="padding: 8px;">${result.shipName || '-'}</td>`;
      html += `<td style="padding: 8px;">${link.section || ''}</td>`;
      html += `<td style="padding: 8px; color: ${availabilityColor}; text-align: center;"><strong>${availabilityText}</strong></td>`;
      html += `<td style="padding: 8px; text-align: center;">${result.shipOptions ? result.shipOptions.length : '0'}</td>`;
      
      // Ship details
      html += '<td style="padding: 8px;">';
      html += `Tours Page: <a href="${result.toursUrl}" target="_blank">Check Tours</a><br>`;
      if (result.shipOptions && result.shipOptions.length > 0) {
        html += 'Available Ships:<br>';
        html += '<ul style="margin: 0; padding-left: 20px;">';
        result.shipOptions.slice(0, 3).forEach(ship => {
          html += `<li>${ship}</li>`;
        });
        if (result.shipOptions.length > 3) {
          html += `<li>...and ${result.shipOptions.length - 3} more</li>`;
        }
        html += '</ul>';
      } else {
        html += 'No ships found in tours page';
      }
      html += '</td>';
      
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    html += '</div>'; // End cruise ships tab
    
    // Cruises tab
    html += '<div class="tab-content" id="tab-cruises" style="display: none;">';
    html += '<table border="1" style="border-collapse: collapse; width: 100%;" class="filterable-table">';
    html += '<thead style="background-color: #f2f2f2;"><tr>' + 
            '<th>#</th>' +
            '<th>Cruise</th>' + 
            '<th>URL</th>' + 
            '<th>ID</th>' + 
            '<th>Section</th>' +
            '<th>Available</th>' + 
            '<th>Price</th>' +
            '<th>Details</th>' +
            '</tr></thead>';
    html += '<tbody>';
    
    const cruiseLinks = relevantResults.filter(link => 
      link.urlPattern === 'cruise-with-id'
    );
    
    cruiseLinks.forEach((link, index) => {
      const result = link.checkResult;
      
      // Determine availability color and text based on final status
      let availabilityColor, availabilityText;
      
      if (result.finalStatus === 'broken_link_404') {
        availabilityColor = 'purple';
        availabilityText = 'Broken 404';
      } else if (result.finalStatus === 'under_maintenance') {
        availabilityColor = 'orange';
        availabilityText = 'Maintenance';
      } else if (result.finalStatus === 'timeout') {
        availabilityColor = 'gray';
        availabilityText = 'Timeout';
      } else if (result.available) {
        availabilityColor = 'green';
        availabilityText = 'Yes';
      } else if (result.available === false) {
        availabilityColor = 'red';
        availabilityText = 'No';
      } else {
        availabilityColor = 'gray';
        availabilityText = 'Unknown';
      }
      
      html += `<tr data-section="${link.section || ''}">`;
      html += `<td style="padding: 8px; text-align: center;">${index + 1}</td>`;
      html += `<td style="padding: 8px;"><strong>${link.text}</strong></td>`;
      html += `<td style="padding: 8px; font-family: monospace;"><a href="${link.href}" target="_blank">${link.href}</a></td>`;
      html += `<td style="padding: 8px; text-align: center;">${result.cruiseId || '-'}</td>`;
      html += `<td style="padding: 8px;">${link.section || ''}</td>`;
      html += `<td style="padding: 8px; color: ${availabilityColor}; text-align: center;"><strong>${availabilityText}</strong></td>`;
      html += `<td style="padding: 8px;">${result.priceText || 'Not found'}</td>`;
      html += `<td style="padding: 8px;">${result.pageTitle || '-'}<br>${result.departureInfo || ''} ${result.durationInfo || ''}</td>`;
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    html += '</div>'; // End cruises tab
    
    // Activities tab
    html += '<div class="tab-content" id="tab-activities" style="display: none;">';
    html += '<table border="1" style="border-collapse: collapse; width: 100%;" class="filterable-table">';
    html += '<thead style="background-color: #f2f2f2;"><tr>' + 
            '<th>#</th>' +
            '<th>Activity</th>' + 
            '<th>URL</th>' + 
            '<th>Activity Text</th>' + 
            '<th>Section</th>' +
            '<th>Available</th>' + 
            '<th>Experience Options</th>' +
            '<th>Activity Options</th>' +
            '</tr></thead>';
    html += '<tbody>';
    
    const activityLinks = relevantResults.filter(link => 
      link.urlPattern === 'tour-activity' || link.urlPattern === 'destination/tours/activity'
    );
    
    activityLinks.forEach((link, index) => {
      const result = link.checkResult;
      
      // Determine availability color and text based on final status
      let availabilityColor, availabilityText;
      
      if (result.finalStatus === 'broken_link_404') {
        availabilityColor = 'purple';
        availabilityText = 'Broken 404';
      } else if (result.finalStatus === 'under_maintenance') {
        availabilityColor = 'orange';
        availabilityText = 'Maintenance';
      } else if (result.finalStatus === 'timeout') {
        availabilityColor = 'gray';
        availabilityText = 'Timeout';
      } else if (result.available) {
        availabilityColor = 'green';
        availabilityText = 'Yes';
      } else if (result.available === false) {
        availabilityColor = 'red';
        availabilityText = 'No';
      } else {
        availabilityColor = 'gray';
        availabilityText = 'Unknown';
      }
      
      html += `<tr data-section="${link.section || ''}">`;
      html += `<td style="padding: 8px; text-align: center;">${index + 1}</td>`;
      html += `<td style="padding: 8px;"><strong>${link.text}</strong></td>`;
      html += `<td style="padding: 8px; font-family: monospace;"><a href="${link.href}" target="_blank">${link.href}</a></td>`;
      html += `<td style="padding: 8px;">${result.activityText || '-'}</td>`;
      html += `<td style="padding: 8px;">${link.section || ''}</td>`;
      html += `<td style="padding: 8px; color: ${availabilityColor}; text-align: center;"><strong>${availabilityText}</strong></td>`;
      
      // Experience options
      html += '<td style="padding: 8px;">';
      if (result.experienceOptions && result.experienceOptions.length > 0) {
        html += '<ul style="margin: 0; padding-left: 20px;">';
        result.experienceOptions.slice(0, 5).forEach(option => {
          html += `<li>${option}</li>`;
        });
        if (result.experienceOptions.length > 5) {
          html += `<li>...and ${result.experienceOptions.length - 5} more</li>`;
        }
        html += '</ul>';
      } else {
        html += 'None found';
      }
      html += '</td>';
      
      // Activity options
      html += '<td style="padding: 8px;">';
      if (result.activityOptions && result.activityOptions.length > 0) {
        html += '<ul style="margin: 0; padding-left: 20px;">';
        result.activityOptions.slice(0, 5).forEach(option => {
          html += `<li>${option}</li>`;
        });
        if (result.activityOptions.length > 5) {
          html += `<li>...and ${result.activityOptions.length - 5} more</li>`;
        }
        html += '</ul>';
      } else {
        html += 'None found';
      }
      html += '</td>';
      
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    html += '</div>'; // End activities tab
    
    // Special Destination Pages tab (NEW)
    if (specialDestinationResults.length > 0) {
      html += '<div class="tab-content" id="tab-special-destinations" style="display: none;">';
      html += '<div style="margin-bottom: 10px; padding: 10px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px;">';
      html += '<strong>Special Destination Pages:</strong> These are destination URLs with special endings (/land-tours, /ships, /videos, /myTrips, /articles) that are automatically skipped from availability checking.';
      html += '</div>';
      html += '<table border="1" style="border-collapse: collapse; width: 100%;" class="filterable-table">';
      html += '<thead style="background-color: #f2f2f2;"><tr>' + 
              '<th>#</th>' +
              '<th>Text</th>' + 
              '<th>URL</th>' + 
              '<th>Ending Type</th>' + 
              '<th>Section</th>' +
              '<th>Status</th>' +
              '<th>Reason Skipped</th>' +
              '</tr></thead>';
      html += '<tbody>';
      
      specialDestinationResults.forEach((link, index) => {
        const result = link.checkResult;
        
        // Extract the ending type from the URL
        let endingType = 'Unknown';
        if (link.href.endsWith('land-tours')) endingType = 'Land Tours';
        else if (link.href.endsWith('ships')) endingType = 'Ships';
        else if (link.href.endsWith('videos')) endingType = 'Videos';
        else if (link.href.endsWith('myTrips')) endingType = 'My Trips';
        else if (link.href.endsWith('articles')) endingType = 'Articles';
        else if (link.href.endsWith('cruises')) endingType = 'Cruises';
        else if (link.href.endsWith('tours')) endingType = 'Tours';
        else if (link.href.endsWith('hotels')) endingType = 'Hotels';
        else if (link.href.endsWith('deals')) endingType = 'Deals';
        else if (link.href.endsWith('info')) endingType = 'Info';
        
        html += `<tr data-section="${link.section || ''}">`;
        html += `<td style="padding: 8px; text-align: center;">${index + 1}</td>`;
        html += `<td style="padding: 8px;"><strong>${link.text}</strong></td>`;
        html += `<td style="padding: 8px; font-family: monospace;"><a href="${link.href}" target="_blank">${link.href}</a></td>`;
        html += `<td style="padding: 8px;">${endingType}</td>`;
        html += `<td style="padding: 8px;">${link.section || ''}</td>`;
        html += `<td style="padding: 8px; color: orange; text-align: center;"><strong>Skipped</strong></td>`;
        html += `<td style="padding: 8px;">Special destination page (${endingType.toLowerCase()}) - automatically skipped from availability checking</td>`;
        html += '</tr>';
      });
      
      html += '</tbody></table>';
      html += '</div>'; // End special destinations tab
    }
    
    // Skipped links tab
    html += '<div class="tab-content" id="tab-skipped" style="display: none;">';
    html += '<div style="margin-bottom: 10px;">These links were identified as non-destination content pages (articles, stories, etc.) and skipped from checking.</div>';
    html += '<table border="1" style="border-collapse: collapse; width: 100%;" class="filterable-table">';
    html += '<thead style="background-color: #f2f2f2;"><tr>' + 
            '<th>#</th>' +
            '<th>Text</th>' + 
            '<th>URL</th>' + 
            '<th>URL Pattern</th>' + 
            '<th>Section</th>' +
            '<th>Reason Skipped</th>' +
            '</tr></thead>';
    html += '<tbody>';
    
    skippedResults.forEach((link, index) => {
      const result = link.checkResult;
      
      html += `<tr data-section="${link.section || ''}">`;
      html += `<td style="padding: 8px; text-align: center;">${index + 1}</td>`;
      html += `<td style="padding: 8px;"><strong>${link.text}</strong></td>`;
      html += `<td style="padding: 8px; font-family: monospace;"><a href="${link.href}" target="_blank">${link.href}</a></td>`;
      html += `<td style="padding: 8px;">${link.urlPattern}</td>`;
      html += `<td style="padding: 8px;">${link.section || ''}</td>`;
      html += `<td style="padding: 8px;">${result.error || 'Not a valid destination, tour, cruise, or activity link'}</td>`;
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    html += '</div>'; // End skipped links tab
    
    html += '</div>'; // End tab container
    
    // Add tab switching script and section filter functionality
    html += `
    <script>
      // Tab switching functionality
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', () => {
    // Remove active class from all buttons and content
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    
    // Add active class to clicked button
    button.classList.add('active');
    
    // Show corresponding content
    const tabId = button.getAttribute('data-tab');
    document.getElementById('tab-' + tabId).style.display = 'block';
    
    // Apply current filters
    applyAllFilters();
  });
});

// Combined filter functionality
function applyAllFilters() {
  const sectionType = document.getElementById('section-type-filter').value;
  const availabilityStatus = document.getElementById('availability-status-filter').value;
  
  const tables = document.querySelectorAll('.filterable-table');
  
  tables.forEach(table => {
    const rows = table.querySelectorAll('tbody tr');
    let visibleCount = 0;
    
    rows.forEach(row => {
      const rowSection = row.getAttribute('data-section');
      const availableCell = row.querySelector('td:nth-child(6)'); // Available column
      let rowStatus = 'unknown';
      
      if (availableCell) {
        const statusText = availableCell.textContent.trim().toLowerCase();
        if (statusText.includes('yes')) {
          rowStatus = 'available';
        } else if (statusText.includes('no')) {
          rowStatus = 'unavailable';
        } else if (statusText.includes('broken') || statusText.includes('404')) {
          rowStatus = 'broken';
        } else if (statusText.includes('maintenance')) {
          rowStatus = 'maintenance';
        } else if (statusText.includes('timeout')) {
          rowStatus = 'timeout';
        } else {
          rowStatus = 'unknown';
        }
      }
      
      // Check section filter
      const sectionMatch = (sectionType === 'all' || rowSection === sectionType);
      
      // Check availability filter
      const availabilityMatch = (availabilityStatus === 'all' || rowStatus === availabilityStatus);
      
      if (sectionMatch && availabilityMatch) {
        row.style.display = '';
        visibleCount++;
      } else {
        row.style.display = 'none';
      }
    });
    
    // Update row numbers for visible rows
    updateRowNumbersForTable(table);
    
    // Show/hide "no results" message
    const noResultsMessage = table.parentNode.querySelector('.no-results-message');
    if (noResultsMessage) {
      noResultsMessage.style.display = visibleCount === 0 ? 'block' : 'none';
    } else if (visibleCount === 0) {
      // Create a message if it doesn't exist
      const message = document.createElement('div');
      message.className = 'no-results-message';
      message.innerHTML = '<p style="padding: 15px; background-color: #f8f8f8; border: 1px solid #ddd; margin-top: 10px; color: #666;">No links found matching the current filters. Try adjusting the section or status filters.</p>';
      table.parentNode.insertBefore(message, table.nextSibling);
    }
  });
}

// Function to update row numbers for a table
function updateRowNumbersForTable(table) {
  const visibleRows = Array.from(table.querySelectorAll('tbody tr'))
    .filter(row => row.style.display !== 'none');
  
  visibleRows.forEach((row, index) => {
    const numberCell = row.querySelector('td:first-child');
    if (numberCell) {
      numberCell.textContent = (index + 1);
    }
  });
}

// Add event listeners to both filter dropdowns
document.getElementById('section-type-filter').addEventListener('change', applyAllFilters);
document.getElementById('availability-status-filter').addEventListener('change', applyAllFilters);

// Initialize filtering
applyAllFilters();
    </script>
    `;
  }
  
  return html;
}

// Function to open results in a new window for better viewing
function openResultsInNewWindow(data) {
  const html = generateHtmlTable(data);
  const newWindow = window.open('', 'Link Extraction Results', 'width=1000,height=800,scrollbars=yes');
  
  newWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Link Extraction Results</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1, h2 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
        th { background-color: #f2f2f2; text-align: left; padding: 10px; }
        td { padding: 8px; border: 1px solid #ddd; }
        .url { font-family: monospace; }
        .count { text-align: center; }
        .tab-button.active { background-color: #ddd; font-weight: bold; }
        .summary-block { 
          background-color: #f5f5f5; 
          padding: 15px; 
          border-radius: 5px; 
          margin-bottom: 20px;
          border: 1px solid #ddd;
        }
        .summary-title {
          font-weight: bold;
          margin-bottom: 10px;
          font-size: 16px;
        }
        .summary-count {
          font-size: 24px;
          font-weight: bold;
          color: #333;
          margin-right: 5px;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }
        .no-results-message {
          padding: 15px;
          background-color: #f8f8f8;
          border: 1px solid #ddd;
          margin-top: 10px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <h1>Link Extraction Results</h1>
      
      <!-- Summary section with counts -->
      <div class="summary-block">
        <div class="summary-title">Summary</div>
        <div style="display: flex; flex-wrap: wrap; gap: 20px;">
          <div>
            <span class="summary-count">${data.summary.totalLinks}</span>
            <span>Total Links</span>
          </div>
          
          <div>
            <span class="summary-count">${Object.keys(data.summary.sectionTypes).length}</span>
            <span>Section Types</span>
          </div>
          
          <div>
            <span class="summary-count">${Object.keys(data.summary.urlPatterns).length}</span>
            <span>URL Patterns</span>
          </div>
          
          ${data.availability ? `
          <div>
            <span class="summary-count">${data.availability.available}</span>
            <span style="color: green;">Available Links</span>
          </div>
          
          <div>
            <span class="summary-count">${data.availability.unavailable}</span>
            <span style="color: red;">Unavailable Links</span>
          </div>
          
          <div>
            <span class="summary-count">${data.availability.details.filter(l => l.section === 'Table').length}</span>
            <span>Table Links</span>
          </div>

          <div>
            <span class="summary-count">${data.availability.details.filter(l => l.checkResult && l.checkResult.checkMethod === 'user-tools-info').length}</span>
            <span style="color: blue;">Destinations (user-tools-info)</span>
          </div>
          
          <div>
            <span class="summary-count">${data.availability.details.filter(l => l.urlPattern === 'destination-special-page').length}</span>
            <span style="color: orange;">Special Destination Pages (Skipped)</span>
          </div>
          ` : ''}
        </div>
      </div>
      
      ${html}
      
      <h2>Export Data</h2>
      <button onclick="exportJSON()">Export as JSON</button>
      <button onclick="exportCSV()">Export as CSV</button>
      <script>
        function exportJSON() {
          const dataStr = JSON.stringify(${JSON.stringify(data)}, null, 2);
          const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
          const exportFileDefaultName = 'link_extraction_data.json';
          const linkElement = document.createElement('a');
          linkElement.setAttribute('href', dataUri);
          linkElement.setAttribute('download', exportFileDefaultName);
          linkElement.click();
        }
        
        function exportCSV() {
          let csv = 'Link Type,Text,URL,Section,Available,Check Method,Level,Details\\n';
          
          // Add data from the availability data
          const availabilityData = ${JSON.stringify(data.availability ? data.availability.details : [])};
          
          if (availabilityData && availabilityData.length > 0) {
            availabilityData.forEach(link => {
              if (!link.checkResult) return;
              
              const result = link.checkResult;
              
              // Determine availability text based on final status
              let availableText;
              if (result.finalStatus === 'broken_link_404') {
                availableText = 'Broken 404';
              } else if (result.finalStatus === 'under_maintenance') {
                availableText = 'Maintenance';
              } else if (result.finalStatus === 'timeout') {
                availableText = 'Timeout';
              } else if (result.available) {
                availableText = 'Yes';
              } else if (result.available === false) {
                availableText = 'No';
              } else if (link.urlPattern === 'destination-special-page') {
                availableText = 'Skipped (Special)';
              } else {
                availableText = 'Unknown';
              }
              
              // Create details text based on link type and status
              let detailsText = '';
              
              if (link.urlPattern === 'destination-special-page') {
                let endingType = 'Unknown';
                if (link.href.endsWith('land-tours')) endingType = 'Land Tours';
                else if (link.href.endsWith('ships')) endingType = 'Ships';
                else if (link.href.endsWith('videos')) endingType = 'Videos';
                else if (link.href.endsWith('myTrips')) endingType = 'My Trips';
                else if (link.href.endsWith('articles')) endingType = 'Articles';
                else if (link.href.endsWith('cruises')) endingType = 'Cruises';
                else if (link.href.endsWith('tours')) endingType = 'Tours';
                else if (link.href.endsWith('hotels')) endingType = 'Hotels';
                else if (link.href.endsWith('deals')) endingType = 'Deals';
                else if (link.href.endsWith('info')) endingType = 'Info';
                detailsText = 'Special destination page (' + endingType + ') - automatically skipped';
              } else if (result.finalStatus === 'broken_link_404') {
                detailsText = 'Broken Link 404 - Page not found';
              } else if (result.finalStatus === 'under_maintenance') {
                detailsText = 'Under maintenance (tried ' + (result.retryAttempts || 1) + ' times)';
              } else if (result.finalStatus === 'timeout') {
                detailsText = 'Timeout after ' + (result.retryAttempts || 1) + ' attempts';
              } else if (link.urlPattern === 'tour-with-id') {
                detailsText = 'Tour ID: ' + (result.tourId || '-') + ', Price: ' + (result.priceText || 'Not found');
              } else if (link.urlPattern === 'cruise-ship') {
                detailsText = 'Ship: ' + (result.shipName || '-') + ', Ships Available: ' + (result.shipOptions ? result.shipOptions.length : '0');
              } else if (link.urlPattern === 'cruise-with-id') {
                detailsText = 'Cruise ID: ' + (result.cruiseId || '-') + ', Price: ' + (result.priceText || 'Not found');
              } else if (link.urlPattern === 'tour-activity' || link.urlPattern === 'destination/tours/activity') {
                detailsText = 'Activity: ' + (result.activityText || '-');
              } else {
                detailsText = 'User Tools Info: ' + (result.userToolsInfo || 'Not found');
              }
              
              // Escape quotes in CSV
              const escapedText = link.text ? link.text.replace(/"/g, '""') : '';
              const escapedDetailsText = detailsText.replace(/"/g, '""');
              const sectionText = link.section || '';
              const checkMethod = result.checkMethod || 'user-tools-info';
              const level = result.destinationLevel || '1';
              
              csv += '"' + (getReadableLinkType(link.urlPattern) || link.urlPattern) + '","' + escapedText + '","' + link.href + '","' + 
                    sectionText + '","' + availableText + '","' + checkMethod + '","' + level + '","' + escapedDetailsText + '"\\n';
            });
          }
          
          const dataUri = 'data:text/csv;charset=utf-8,'+ encodeURIComponent(csv);
          const exportFileDefaultName = 'link_extraction_data.csv';
          const linkElement = document.createElement('a');
          linkElement.setAttribute('href', dataUri);
          linkElement.setAttribute('download', exportFileDefaultName);
          linkElement.click();
        }
        
        // Define getReadableLinkType function for CSV export
        function getReadableLinkType(urlPattern) {
          if (urlPattern === 'tour-with-id') return 'Tour';
          if (urlPattern === 'cruise-ship') return 'Cruise Ship';
          if (urlPattern === 'cruise-with-id') return 'Cruise';
          if (urlPattern === 'operator-with-id') return 'Operator';
          if (urlPattern === 'tour-activity') return 'Activity';
          if (urlPattern === 'tours-category') return 'Tours';
          if (urlPattern === 'cruises-category') return 'Cruises';
          if (urlPattern === 'destination-special-page') return 'Special Destination Page';
          if (urlPattern.startsWith('multi-level/destination-')) {
            const level = urlPattern.split('-')[1];
            return level === '1' ? 'Destination' : 'Subdestination';
          }
          if (urlPattern.includes('/articles')) return 'Article';
          if (urlPattern.includes('/stories')) return 'Story';
          if (urlPattern.includes('/deals')) return 'Deal';
          return urlPattern.split('/').pop() || 'Unknown';
        }
      </script>
    </body>
    </html>
  `);
  
  newWindow.document.close();
}

// Execute the function and store the result
async function runExtraction(checkAvailability = false) {
  console.log(`Starting link extraction${checkAvailability ? ' with availability check' : ''}...`);
  
  try {
    const extractedLinks = await enhancedLinkExtractorWithAvailabilityCheck(checkAvailability);
    console.log('Extraction complete. The raw data is available in the variable "extractedLinks"');

    // Open results in a new window for better viewing
    if (extractedLinks && extractedLinks.summary.totalLinks > 0) {
      console.log('Opening detailed results in a new window...');
      openResultsInNewWindow(extractedLinks);
    } else {
      console.log('No links were found or there was an error.');
    }
    
    return extractedLinks;
  } catch (error) {
    console.error('An error occurred during extraction:', error);
    return null;
  }
}

// Ask user if they want to check availability
const checkAvailability = confirm(
  "Do you want to check link availability?\n\n" +
  "This will check:\n" + 
  "- All Destinations (level 1+): by matching title in user-tools-info (.al-user-tools-info > div:first-child span)\n" +
  "- Tours: by checking if price exists and is > 0\n" +
  "- Cruise Ships (/cruises/ID/ship-name): by checking ship list on current-page/tours\n" +
  "- Cruises (/destination/cruises/ID/cruise-name): by checking if price exists and is > 0\n" +
  "- Activities: by checking for activity in option lists\n" +
  "- Table Links: all links in table sections\n\n" +
  "🔄 NEW FEATURES:\n" +
  "- Auto-retry for maintenance pages (up to 3 attempts, 10 sec delays)\n" +
  "- 404 Detection: Broken links marked as 'Broken Link 404'\n" +
  "- Maintenance Detection: Pages under maintenance marked separately\n" +
  "- Status Categories: Available, Unavailable, Maintenance, Broken 404, Timeout\n" +
  "- Special Destination Pages: URLs ending with /land-tours, /ships, /videos, /myTrips are automatically skipped\n\n" +
  "This process can take several minutes depending on the number of links."
);
// TEST FUNCTION - Add this before the final execution
async function testSpecificURL(url, expectedTitle) {
  console.log(`\n🧪 TESTING SPECIFIC URL: ${url}`);
  console.log(`📝 Expected title: "${expectedTitle}"`);
  
  const urlPattern = determineUrlPattern(url);
  console.log(`🏷️ Detected pattern: ${urlPattern}`);
  
  if (isTrueDestination(url, urlPattern)) {
    console.log(`✅ Confirmed as true destination`);
    
    // Get absolute URL
    const baseUrl = window.location.origin;
    const absoluteUrl = url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    
    console.log(`🌐 Testing URL: ${absoluteUrl}`);
    
    try {
      const result = await checkActivityAvailability(absoluteUrl, expectedTitle, urlPattern);
      
      console.log(`\n📊 TEST RESULTS:`);
      console.log(`Available: ${result.available}`);
      console.log(`Page Status: ${result.pageStatus}`);
      console.log(`Check Method: ${result.checkMethod}`);
      console.log(`User Tools Info: "${result.userToolsInfo}"`);
      console.log(`Page Title: "${result.pageTitle}"`);
      console.log(`Error: ${result.error}`);
      
      if (result.debugInfo) {
        console.log(`Debug Info:`, result.debugInfo);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Test failed:`, error);
      return null;
    }
  } else {
    console.log(`❌ Not recognized as a destination URL`);
    return null;
  }
}

// Uncomment the line below to test the specific URL:
// testSpecificURL('/iceland/vik', 'Vik');
// Run the extraction with or without availability check
const extractedLinks = runExtraction(checkAvailability);
