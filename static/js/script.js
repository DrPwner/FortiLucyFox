// static/js/script.js
let menuContainer;
window.FortiLucene = {};
window.queries = {}; // Make queries globally accessible

document.addEventListener('DOMContentLoaded', function() {
    const queryParts = document.getElementById('query-parts');
    const buildQueryBtn = document.getElementById('build-query');
    const queryResult = document.getElementById('query-result');
    const copyQueryBtn = document.getElementById('copy-query');
    menuContainer = document.createElement('div');
    menuContainer.id = 'menu-container';
    document.body.appendChild(menuContainer);

    let categories = [];

    // Fetch categories and queries when the page loads
    fetch('/get_categories')
        .then(response => response.json())
        .then(data => {
            categories = data;
            return Promise.all(categories.map(category => 
                fetch(`/get_queries/${category}`)
                    .then(response => response.json())
                    .then(categoryQueries => {
                        window.queries[category] = categoryQueries;
                    })
            ));
        })
        .then(() => {
            queryParts.appendChild(createQueryPart());
        });

        window.createQueryPart = createQueryPart;


FortiLucene.populateQueryBuilder = function(query) {
    const queryParts = document.getElementById('query-parts');
    queryParts.innerHTML = '';

    const parts = FortiLucene.parseQuery(query);

    parts.forEach((part, index) => {
        const queryPart = window.createQueryPart();
        queryParts.appendChild(queryPart);

        // Set the query field
        const querySelect = queryPart.querySelector('.query-select');
        if (querySelect) {
            const option = Array.from(querySelect.options).find(opt => opt.value.includes(part.field));
            if (option) {
                querySelect.value = option.value;
            }
        }

        // Set the query operator
        const queryOperator = queryPart.querySelector('.query-operator');
        if (queryOperator) {
            queryOperator.textContent = part.prefix || '→';
        }

        // Set the values and operators
        const inputGroup = queryPart.querySelector('.input-group');
        FortiLucene.setInputValues(inputGroup, part.values, part.operators);

        // Set the connector for the next part
        if (index < parts.length - 1) {
            const operatorSelect = queryPart.querySelector('.operator-select');
            if (operatorSelect) {
                operatorSelect.value = parts[index + 1].connector || 'NULL';
            }
        }
    });

    // Trigger a click on the "Build Query" button to update the query result
    const buildQueryBtn = document.getElementById('build-query');
    if (buildQueryBtn) {
        buildQueryBtn.click();
    }
};

FortiLucene.parseQuery = function(query) {
    const parts = [];
    const regex = /(NOT\s+|-|!)?((\w+(?:\.\w+)*):)\s*\((.*?)\)(?:\s+(AND|OR|NOT)\s+)?/g;
    let match;

    while ((match = regex.exec(query)) !== null) {
        const [, prefix, , field, values, connector] = match;
        const valueOperatorPairs = values.split(/\s+(&&|\|\||TO)\s+/);
        const parsedValues = [];
        const operators = [];

        valueOperatorPairs.forEach((item, index) => {
            if (index % 2 === 0) {
                parsedValues.push(item.replace(/^"(.*)"$/, '$1')); // Remove quotes if present
            } else {
                operators.push(item);
            }
        });

        parts.push({
            prefix: prefix ? prefix.trim() : undefined,
            field,
            values: parsedValues,
            operators,
            connector: connector ? connector.trim() : undefined
        });
    }

    return parts;
};

        FortiLucene.setCategoryAndQuery = function(categorySelect, querySelect, field) {
            // Find the category that contains the field
            for (let i = 0; i < categorySelect.options.length; i++) {
                const category = categorySelect.options[i].value;
                const categoryQueries = window.queries[category];
                if (categoryQueries) {
                    const matchingQuery = categoryQueries.find(q => q.builtin.includes(field));
                    
                    if (matchingQuery) {
                        categorySelect.value = category;
                        updateQuerySelect(querySelect, category);
                        querySelect.value = matchingQuery.builtin;
                        return;
                    }
                }
            }
            console.warn(`No matching category or query found for field: ${field}`);
        };

        FortiLucene.setInputValues = function(inputGroup, values, operators) {
            const valueInput = inputGroup.querySelector('.value-input');
            if (valueInput) {
                valueInput.value = values[0] || '';
            }
        
            // Add additional input boxes for multiple values
            for (let i = 1; i < values.length; i++) {
                const operator = operators[i - 1] || '&&';
                window.addInputBox(inputGroup, operator);
                const newInputGroup = inputGroup.lastElementChild;
                const newInput = newInputGroup.querySelector('.value-input');
                if (newInput) {
                    newInput.value = values[i] || '';
                }
                
                // Set the operator without changing the dropdown button appearance
                const dropdown = newInputGroup.querySelector('.dropdown');
                if (dropdown) {
                    const button = dropdown.querySelector('.dropbtn');
                    if (button) {
                        // Create a hidden span to store the operator
                        const operatorSpan = document.createElement('span');
                        operatorSpan.style.display = 'none';
                        operatorSpan.textContent = operator;
                        button.appendChild(operatorSpan);
                        
                        // Ensure the button still shows the three-dot icon
                        const icon = button.querySelector('i') || document.createElement('i');
                        icon.className = 'fas fa-ellipsis-v';
                        button.appendChild(icon);
                    }
                }
            }
        };

        // Make addInputBox function globally accessible
window.addInputBox = function(inputGroup, operator) {
    const newInputGroup = document.createElement('div');
    newInputGroup.className = 'input-group';

    const opSpan = document.createElement('span');
    opSpan.textContent = operator;
    opSpan.className = 'input-operator';

    const newInput = document.createElement('input');
    newInput.type = 'text';
    newInput.className = 'value-input';
    newInput.placeholder = 'Value';

    const endDropdown = createDropdown(['NULL', '||', '&&', '!', '_exists_', '+', '-', '.', 'Delete'], (op) => {
        if (op === 'Delete') {
            newInputGroup.remove();
        } else {
            addInputBox(inputGroup, op);
        }
    });

    newInputGroup.appendChild(opSpan);
    newInputGroup.appendChild(newInput);
    newInputGroup.appendChild(endDropdown);

    inputGroup.appendChild(newInputGroup);
};

window.FortiLucene = window.FortiLucene || {};

FortiLucene.populateQueryBuilder = function(query) {
    const queryParts = document.getElementById('query-parts');
    queryParts.innerHTML = '';

    const parts = FortiLucene.parseQuery(query);

    parts.forEach((part, index) => {
        const queryPart = window.createQueryPart();
        queryParts.appendChild(queryPart);

        // Set the category and query
        const categorySelect = queryPart.querySelector('.category-select');
        const querySelect = queryPart.querySelector('.query-select');
        FortiLucene.setCategoryAndQuery(categorySelect, querySelect, part.field);

        // Set the query operator
        const queryOperator = queryPart.querySelector('.query-operator');
        if (queryOperator) {
            queryOperator.textContent = part.prefix || '→';
        }

        // Set the values and operators
        const inputGroup = queryPart.querySelector('.input-group');
        FortiLucene.setInputValues(inputGroup, part.values, part.operators);

        // Set the connector for the next part
        if (index < parts.length - 1) {
            const operatorSelect = queryPart.querySelector('.operator-select');
            if (operatorSelect) {
                operatorSelect.value = parts[index].connector || 'NULL';
            }
        }
    });

    // Trigger a click on the "Build Query" button to update the query result
    const buildQueryBtn = document.getElementById('build-query');
    if (buildQueryBtn) {
        buildQueryBtn.click();
    }
};
    
    function createQueryPart() {
        const part = document.createElement('div');
        part.className = 'query-part';
        
        const categorySelect = document.createElement('select');
        categorySelect.className = 'category-select';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });

        const querySelect = document.createElement('select');
        querySelect.className = 'query-select';

        const queryOperatorSpan = document.createElement('span');
        queryOperatorSpan.className = 'query-operator';
        queryOperatorSpan.textContent = '→';

        const queryDropdown = createDropdown(['→', 'NOT', '-', '!'], (op) => {
            queryOperatorSpan.textContent = op;
        });

        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';

        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'value-input';
        valueInput.placeholder = 'Value';

        const currentOperator = document.createElement('span');
        currentOperator.className = 'current-operator';
        currentOperator.style.display = 'none';

        const endDropdown = createDropdown(['||', '&&', 'TO' , 'Import'], (op) => {
          
            if (op === 'Import') {
                showImportOperators(endDropdown, valueInput);
            } else {
                addInputBox(inputGroup, op);
            }
        });
        inputGroup.appendChild(valueInput);
        inputGroup.appendChild(endDropdown);
        inputGroup.appendChild(endDropdown);


        //removed so that the input box doesnt affect the three dot menu visibility.
        // endDropdown.style.display = 'none';

        // valueInput.addEventListener('input', () => {
        //     endDropdown.style.display = valueInput.value ? 'inline-block' : 'none';
        // });

        const operatorSelect = document.createElement('select');
        operatorSelect.className = 'operator-select';
        ['NULL', 'AND', 'OR', 'NOT'].forEach(op => {
            const option = document.createElement('option');
            option.value = op;
            option.textContent = op;
            operatorSelect.appendChild(option);
        });

        operatorSelect.addEventListener('change', () => {
            if (operatorSelect.value !== 'NULL' && part.nextElementSibling === null) {
                queryParts.appendChild(createQueryPart());
            }
        });

        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.className = 'remove-btn';
        removeBtn.addEventListener('click', () => {
            part.remove();
            if (queryParts.children.length === 0) {
                queryParts.appendChild(createQueryPart());
            }
        });

        categorySelect.addEventListener('change', () => {
            updateQuerySelect(querySelect, categorySelect.value);
        });

        part.appendChild(categorySelect);
        part.appendChild(queryOperatorSpan);
        part.appendChild(queryDropdown);
        part.appendChild(querySelect);
        part.appendChild(inputGroup);
        part.appendChild(operatorSelect);
        part.appendChild(removeBtn);

        updateQuerySelect(querySelect, categorySelect.value);

        return part;
    }

    function updateQuerySelect(querySelect, category) {
        querySelect.innerHTML = '';
        queries[category].forEach(query => {
            const option = document.createElement('option');
            option.value = query.builtin;
            option.textContent = query.friendly;
            querySelect.appendChild(option);
        });
    }

    function updateImportOperator(inputElement, newOperator) {
        if (inputElement.dataset.importedValues) {
            const values = inputElement.dataset.importedValues.split(/\s+(?:&&|\|\||AND|OR)\s+/);
            inputElement.dataset.importedValues = values.join(` ${newOperator} `);
            inputElement.dataset.importedOperator = newOperator;
            
        }
    }


    function createDropdown(options, onSelect) {
        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown';
        
        const button = document.createElement('button');
        button.className = 'dropbtn';
        button.innerHTML = '<i class="fas fa-ellipsis-v"></i>';
        
        const content = document.createElement('div');
        content.className = 'dropdown-content';
        
        options.forEach(op => {
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = op;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (op === 'Import') {
                    showImportOperators(content, button);
                } else {
                    onSelect(op);
                    hideAllMenus();
                }
            });
            content.appendChild(a);
        });
        
        dropdown.appendChild(button);
    
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = button.getBoundingClientRect();
            content.style.top = `${rect.bottom + window.scrollY}px`;
            content.style.left = `${rect.left + window.scrollX}px`;
            hideAllMenus();
            menuContainer.appendChild(content);
            content.style.display = 'block';
    
            // Check if there's a hidden operator span and update the dropdown options
            const operatorSpan = button.querySelector('span');
            if (operatorSpan && operatorSpan.style.display === 'none') {
                const currentOperator = operatorSpan.textContent;
                content.querySelectorAll('a').forEach(a => {
                    if (a.textContent === currentOperator) {
                        a.style.fontWeight = 'bold';
                    } else {
                        a.style.fontWeight = 'normal';
                    }
                });
            }
        });
        
        return dropdown;
    }

    
    function hideAllMenus() {
        const menus = menuContainer.querySelectorAll('.dropdown-content');
        menus.forEach(menu => {
            menu.style.display = 'none';
            if (menu.parentNode === menuContainer) {
                menuContainer.removeChild(menu);
            }
        });
    }
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-content')) {
            hideAllMenus();
        }
    });
    
    
    function showOperatorsWithRemoveImport(dropdown, inputElement) {
        const operators = ['&&', '||', 'Remove Import'];
        const content = dropdown.querySelector('.dropdown-content');
        content.innerHTML = '';
        operators.forEach(op => {
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = op;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (op === 'Remove Import') {
                    removeImport(dropdown);
                } else {
                    updateImportOperator(inputElement, op);
                }
                hideAllMenus();
            });
            content.appendChild(a);
        });
    
        // Reposition the dropdown content
        const rect = dropdown.getBoundingClientRect();
        content.style.top = `${rect.bottom + window.scrollY}px`;
        content.style.left = `${rect.left + window.scrollX}px`;
        content.style.display = 'block';
    }

    function showImportOperators(dropdownContent, sourceButton) {
        const importOperators = ['&&', '||', 'Remove Import'];
        dropdownContent.innerHTML = '';
    
        importOperators.forEach(op => {
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = op;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (op === 'Remove Import') {
                    if (confirm('Are you sure you want to remove the imported file?')) {
                        removeImport(sourceButton);
                        showOriginalMenu(sourceButton);
                    }
                } else if (sourceButton.closest('.query-part').querySelector('.value-input').dataset.importedValues) {
                    updateImportOperator(sourceButton.closest('.query-part').querySelector('.value-input'), op);
                } else {
                    handleImport(sourceButton, op);
                }
                hideAllMenus();
            });
            dropdownContent.appendChild(a);
        });
    
        const rect = sourceButton.getBoundingClientRect();
        dropdownContent.style.top = `${rect.bottom + window.scrollY}px`;
        dropdownContent.style.left = `${rect.left + window.scrollX}px`;
        dropdownContent.style.display = 'block';
    }

    function addInputBox(inputGroup, operator) {
        const newInputGroup = document.createElement('div');
        newInputGroup.className = 'input-group';

        const opSpan = document.createElement('span');
        opSpan.textContent = operator;
        opSpan.className = 'input-operator';

        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.className = 'value-input';
        newInput.placeholder = 'Value';

        const endDropdown = createDropdown(['NULL', '||', '&&', '!', 'Delete'], (op) => {
            if (op === 'Delete') {
                newInputGroup.remove();
            } else {
                addInputBox(inputGroup, op);
            }
        });

        newInputGroup.appendChild(opSpan);
        newInputGroup.appendChild(newInput);
        newInputGroup.appendChild(endDropdown);

        inputGroup.appendChild(newInputGroup);
    }


    //Useless piece of shit
    // function showRemoveImportOption(dropdown, inputElement) {
    //     dropdown.querySelector('.dropdown-content').innerHTML = '';
    //     const removeOption = document.createElement('a');
    //     removeOption.href = '#';
    //     removeOption.textContent = 'Remove Import';
    //     removeOption.addEventListener('click', (e) => {
    //         e.preventDefault();
    //         removeImport(inputElement, dropdown);
    //     });
    //     dropdown.querySelector('.dropdown-content').appendChild(removeOption);
    // }


    function removeImport(sourceButton) {
        const dropdown = sourceButton.closest('.dropdown');
        const inputElement = dropdown.closest('.query-part').querySelector('.value-input');
        inputElement.value = '';
        inputElement.dataset.importedValues = '';
        inputElement.dataset.importedOperator = '';
        inputElement.disabled = false;
    }


function showOriginalMenu(sourceButton) {
    const dropdown = sourceButton.closest('.dropdown');
    const content = dropdown.querySelector('.dropdown-content');
    const originalOptions = ['||', '&&', '+', '-', '.', 'TO', 'Import'];
    
    content.innerHTML = '';
    originalOptions.forEach(op => {
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = op;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (op === 'Import') {
                showImportOperators(content, sourceButton);
            } else {
                addInputBox(sourceButton.closest('.query-part').querySelector('.input-group'), op);
            }
            hideAllMenus();
        });
        content.appendChild(a);
    });

    const rect = sourceButton.getBoundingClientRect();
    content.style.top = `${rect.bottom + window.scrollY}px`;
    content.style.left = `${rect.left + window.scrollX}px`;
    menuContainer.appendChild(content);
    content.style.display = 'block';
}

function handleImport(sourceButton, operator) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt';
   
    fileInput.onchange = function(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
       
        reader.onload = function(e) {
            const content = e.target.result;
            const values = content.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');
            const queryPart = sourceButton.closest('.query-part');
            const inputGroup = queryPart.querySelector('.input-group');
            const mainInput = inputGroup.querySelector('.value-input');

            // Remove all additional input boxes
            const additionalInputs = inputGroup.querySelectorAll('.input-group:not(:first-child)');
            additionalInputs.forEach(input => input.remove());

            // Set the file name and imported values in the main input
            mainInput.value = file.name;
            mainInput.dataset.importedValues = values.join(` ${operator} `);
            mainInput.dataset.importedOperator = operator;
            mainInput.disabled = true;
           
            showOperatorsWithRemoveImport(sourceButton.closest('.dropdown'), mainInput);
        };
       
        reader.readAsText(file);
    };
   
    fileInput.click();
}

buildQueryBtn.addEventListener('click', () => {
    const parts = Array.from(queryParts.children).map(part => {
        const inputGroups = Array.from(part.querySelectorAll('.input-group'));
        let value = inputGroups.map((group, index) => {
            const operator = group.querySelector('.input-operator');
            const input = group.querySelector('.value-input');
            // Only include the operator if it's not the first input
            return index === 0 ? (input.dataset.importedValues || input.value) : `${operator.textContent} ${input.value}`;
        }).join(' ');

        return {
            builtin: part.querySelector('.query-select').value,
            queryOperator: part.querySelector('.query-operator').textContent,
            value: value.trim(),
            operator: part.querySelector('.operator-select').value
        };
    }).filter(part => part.builtin && part.value);
    
        fetch('/build_query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query_parts: parts
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                queryResult.textContent = `Error: ${data.error}`;
                copyQueryBtn.style.display = 'none';
            } else {
                queryResult.textContent = data.query;
                copyQueryBtn.style.display = 'inline-block';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            queryResult.textContent = `Error: ${error.message}`;
            copyQueryBtn.style.display = 'none';
        });
    });
    copyQueryBtn.addEventListener('click', () => {
        safeCopy(queryResult.textContent, 'Query copied to clipboard!');
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const editDatabaseBtn = document.getElementById('edit-database-btn');
    const databaseEditor = document.getElementById('database-editor');
    const closeDatabase = databaseEditor.querySelector('.close');
    const threatHuntingBtn = document.getElementById('threat-hunting-btn');
    const threatIntelBtn = document.getElementById('threat-intel-btn');

    function disableButtons() {
        threatHuntingBtn.classList.add('button-disabled');
        threatIntelBtn.classList.add('button-disabled');
    }

    function enableButtons() {
        threatHuntingBtn.classList.remove('button-disabled');
        threatIntelBtn.classList.remove('button-disabled');
    }

    editDatabaseBtn.addEventListener('click', function() {
        databaseEditor.style.display = 'block';
        disableButtons();
        loadDatabaseContent();
    });

    closeDatabase.addEventListener('click', function() {
        databaseEditor.style.display = 'none';
        enableButtons();
    });

    // Close modal and enable buttons if clicking outside the modal content
    window.addEventListener('click', function(event) {
        if (event.target == databaseEditor) {
            databaseEditor.style.display = 'none';
            enableButtons();
        }
    });
});

// Update the safeCopy function
function safeCopy(text, successMessage = 'Copied to clipboard!') {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
            .then(() => showToast(successMessage))
            .catch(err => {
                console.error('Failed to copy: ', err);
                fallbackCopy(text, successMessage);
            });
    } else {
        fallbackCopy(text, successMessage);
    }
}


// Add this to a new file, e.g., notifications.js
function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Trigger a reflow to enable the transition
    toast.offsetHeight;
    
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-100%)';
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300); // Wait for the transition to finish before removing the element
    }, duration);
}


function fallbackCopy(text, successMessage) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast(successMessage);
        } else {
            showToast('Copying failed. Please copy the text manually.');
        }
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
        showToast('Copying failed. Please copy the text manually.');
    }

    document.body.removeChild(textArea);
}



window.populateQueryBuilder = function(query) {
    // Clear existing query parts
    const queryParts = document.getElementById('query-parts');
    queryParts.innerHTML = '';

    // Parse the query
    const parts = parseQuery(query);

    // Create query parts for each parsed part
    parts.forEach((part, index) => {
        const queryPart = window.createQueryPart();
        queryParts.appendChild(queryPart);

        // Set the category and query select values
        const categorySelect = queryPart.querySelector('.category-select');
        const querySelect = queryPart.querySelector('.query-select');
        setCategoryAndQuery(categorySelect, querySelect, part.field);

        // Set the query operator
        const queryOperator = queryPart.querySelector('.query-operator');
        queryOperator.textContent = part.operator || '→';

        // Set the value(s)
        const inputGroup = queryPart.querySelector('.input-group');
        setInputValues(inputGroup, part.values);

        // Set the operator select (AND, OR, etc.) for the next part
        if (index < parts.length - 1) {
            const operatorSelect = queryPart.querySelector('.operator-select');
            operatorSelect.value = parts[index + 1].connector || 'NULL';
        }
    });
    document.getElementById('build-query').click();
};

function parseQuery(query) {
    const parts = [];
    const regex = /(\w+):\s*\((.*?)\)(?:\s+(AND|OR|NOT)\s+)?/g;
    let match;

    while ((match = regex.exec(query)) !== null) {
        const [, field, values, connector] = match;
        const valueParts = values.split(/\s+(?:&&|\|\|)\s+/);
        const operator = valueParts.length > 1 ? (values.includes('&&') ? '&&' : '||') : null;

        parts.push({
            field,
            values: valueParts,
            operator,
            connector
        });
    }

    return parts;
}

function setCategoryAndQuery(categorySelect, querySelect, field) {
    // Find the category that contains the field
    for (let i = 0; i < categorySelect.options.length; i++) {
        const category = categorySelect.options[i].value;
        const queries = window.queries[category];
        const matchingQuery = queries.find(q => q.builtin.includes(field));
        
        if (matchingQuery) {
            categorySelect.value = category;
            updateQuerySelect(querySelect, category);
            querySelect.value = matchingQuery.builtin;
            return;
        }
    }
}

function setInputValues(inputGroup, values) {
    const valueInput = inputGroup.querySelector('.value-input');
    valueInput.value = values[0];

    // Add additional input boxes for multiple values
    for (let i = 1; i < values.length; i++) {
        const operator = i === 1 ? '&&' : '||';  // Assume && for first additional value, || for others
        addInputBox(inputGroup, operator);
        const newInput = inputGroup.lastElementChild.querySelector('.value-input');
        newInput.value = values[i];
    }
}







//To Enable/disable button

document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('toggle-animation');
    const canvas = document.getElementById('background-canvas');

    toggleBtn.addEventListener('click', function() {
        if (canvas.style.display === 'none') {
            canvas.style.display = 'block';
            toggleBtn.textContent = 'Disable Animation';
        } else {
            canvas.style.display = 'none';
            toggleBtn.textContent = 'Enable Animation';
        }
    });
});


//for help menu button:

document.addEventListener('DOMContentLoaded', function() {
    const helpButton = document.getElementById('help-button');
    const helpMenu = document.getElementById('help-menu');
    const closeHelp = document.getElementById('close-help');

    helpButton.addEventListener('click', function() {
        helpMenu.style.display = 'block';
    });

    closeHelp.addEventListener('click', function() {
        helpMenu.style.display = 'none';
    });

    // Populate help content
    const examplesList = document.getElementById('examples-list');
    const operatorsTable = document.getElementById('operators-table').getElementsByTagName('tbody')[0];
    const wildcardsContent = document.getElementById('wildcards-content');
    const rangesContent = document.getElementById('ranges-content');
    const reservedCharsContent = document.getElementById('reserved-chars-content');

    // Examples
    const examples = [
        "➢ Where the Source command line contains the value NetworkService: \n\n• Source.CommandLine:(NetworkService)",
        "➢Where the value of the remote IP is 10.151.121.130 and remote port is 80:\n• RemoteIP:(10.151.121.130) AND RemotePort:(80)",
        "➢Where the Event includes either the RemoteIP field that contains 10.151.121.130 or the Remote Port field that contains 443:\n• RemoteIP: 10.151.121.130 OR RemotePort: 443",
        "➢Where the ProductName field contains both Microsoft and Windows:\n• Source.File.ProductName: (microsoft AND windows)",
        "➢Where the ProductName field contains Microsoft and does not include Windows:\n• Source.File.ProductName: (microsoft -windows)",
        "➢Where the Product Name field contains the exact phrase \"Microsoft Windows\":\n• Source.File.ProductName: \"microsoft windows\"",
        "➢Where the field Behavior has any non-null value:\n• _exists_: Behavior",
        "➢Where the field PID does not include the value 5292:\n• Source.PID:(NOT 5292)",
        "➢Where the Event does not include the value 5292 in any of the Event fields:\n• NOT 5292"
    ];

    examples.forEach(example => {
        const li = document.createElement('li');
        li.textContent = example;
        examplesList.appendChild(li);
    });

    // Operators
    const operators = [
        { op: "OR , ||", desc: "The query should match either one of the terms/values." },
        { op: "AND, &&", desc: "The query should match both of the terms/values." },
        { op: "NOT, !", desc: "The query should not match the term/value." },
        { op: "_exists_", desc: "The query should match when the field value is not null." },
        { op: "+-", desc: "The term following this operator must be present." },
        { op: ".", desc: "The term following this operator must not be present." }
    ];

    operators.forEach(op => {
        const row = operatorsTable.insertRow();
        const cell1 = row.insertCell(0);
        const cell2 = row.insertCell(1);
        cell1.textContent = op.op;
        cell2.textContent = op.desc;
    });

    // Wildcards
    wildcardsContent.textContent = "Wildcard searches can be run on individual terms using a ? (question mark) to replace a single character, and an * (asterisk) to replace zero or more characters: Progr?m Fil*. Note that wildcard queries may consume huge amounts of memory and perform poorly.";

    // Ranges
    rangesContent.innerHTML = "Ranges can be specified for date, numeric or string fields. The inclusive ranges are specified with square brackets [min TO max] and exclusive ranges with curly brackets {min TO max}.<br><br>Examples:<br>Numbers 1..5: count:[1 TO 5]<br>Numbers from 10 upwards: count:[10 TO *]<br>Dates before 2012: date:{* TO 2012-01-01}<br>Ranges of IPs: RemoteIP: [140.100.100.0 TO 140.100.100.255]";

    // Reserved Characters
    reservedCharsContent.textContent = "Reserved characters are: +, -, =, &&, ||, >, <, !, ( ), { }, [ ], ^, \", ~, *, ?, :, \\ and /. To use these characters in a query, escape them with a leading backslash (\\). For instance, to search for c:\\Windows\\, write the query as c\\:\\\\Windows\\\\.";
});