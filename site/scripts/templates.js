/**
 * Load an HTML template into a DOM element
 * @param {HTMLElement} domElement - The DOM element to load the template into
 * @param {string} templateName - The name of the template file (without .html extension)
 * @param {Object} options - Options object
 * @param {string} options.folder - The folder containing templates (default: 'templates')
 * @param {Function} options.onLoad - Callback function to run after template is loaded
 * @returns {Promise<HTMLElement>} The DOM element with loaded template
 */
async function loadTemplate(domElement, templateName, options = {}) {
    const { folder = 'templates', onLoad = null } = options;
    
    if (!domElement) {
        console.error('loadTemplate: Invalid DOM element');
        return null;
    }

    try {
        const templatePath = `${folder}/${templateName}.html`;
        const response = await fetch(templatePath);
        
        if (!response.ok) {
            throw new Error(`Failed to load template: ${templatePath} (${response.status})`);
        }
        
        const html = await response.text();
        domElement.innerHTML = html;
        
        console.log(`Template loaded: ${templateName}`);
        
        // Call the onLoad callback if provided
        if (onLoad && typeof onLoad === 'function') {
            await onLoad(domElement);
        }
        
        // Dispatch custom event
        domElement.dispatchEvent(new CustomEvent('templateLoaded', {
            detail: { templateName, element: domElement }
        }));
        
        return domElement;
    } catch (error) {
        console.error(`Error loading template "${templateName}":`, error);
        domElement.innerHTML = `<div class="alert alert-danger">Failed to load template: ${templateName}</div>`;
        return null;
    }
}

/**
 * Load multiple templates at once
 * @param {Array<{element: HTMLElement, template: string, onLoad?: Function}>} templates - Array of template configs
 * @param {string} folder - The folder containing templates (default: 'templates')
 * @returns {Promise<Array<HTMLElement>>}
 */
async function loadTemplates(templates, folder = 'templates') {
    const promises = templates.map(({element, template, onLoad}) => 
        loadTemplate(element, template, { folder, onLoad })
    );
    
    return await Promise.all(promises);
}

/**
 * Create a template loader with a specific folder
 * @param {string} folder - The folder containing templates
 * @returns {Function} Function to load templates from the specified folder
 */
function createTemplateLoader(folder) {
    return (domElement, templateName, onLoad) => 
        loadTemplate(domElement, templateName, { folder, onLoad });
}