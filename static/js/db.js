document.addEventListener('DOMContentLoaded', function() {
    const editDatabaseBtn = document.getElementById('edit-database-btn');
    const databaseEditor = document.getElementById('database-editor');
    const closeDatabase = databaseEditor.querySelector('.close');
    const databaseContent = document.getElementById('database-content');
    const saveQueryBtn = document.getElementById('save-query');

    editDatabaseBtn.addEventListener('click', function() {
        databaseEditor.style.display = 'block';
        disableButtons();
        loadDatabaseContent();
    });

    closeDatabase.addEventListener('click', function() {
        databaseEditor.style.display = 'none';
        enableButtons();
    });

    saveQueryBtn.addEventListener('click', function() {
        const queryText = document.getElementById('query-result').textContent;
        // Disable buttons before showing the modal
        disableButtons();
        showModal('Enter a name for this query:', '', (queryName) => {
            if (queryName) {
                saveCustomQuery(queryName, queryText);
            }
            enableButtons();
        });
    });

    function disableButtons() {
        const threatHuntingBtn = document.getElementById('threat-hunting-btn');
        const threatIntelBtn = document.getElementById('threat-intel-btn');
        const kqlHuntingBtn = document.getElementById('kql-hunting-btn');
        
        if (threatHuntingBtn) {
            threatHuntingBtn.classList.add('button-disabled');
        }
        if (threatIntelBtn) {
            threatIntelBtn.classList.add('button-disabled');
        }
        if (kqlHuntingBtn) {
            kqlHuntingBtn.classList.add('button-disabled');
        }
    }

 

    function loadDatabaseContent() {
        fetch('/get_database_content')
            .then(response => response.json())
            .then(data => {
                displayDatabaseContent(data);
            })
            .catch(error => console.error('Error:', error));
    }

    window.loadDatabaseContent = loadDatabaseContent;

    function displayDatabaseContent(data) {
        let content = '';
        for (const tableName in data) {
            content += `
                <div class="table-container">
                    <h3 class="table-header" data-table="${tableName}">${tableName} ⤵</h3>
                    <div id="${tableName}-content" class="table-content" style="display: none;">
                        ${tableName === 'SavedQueries' ? `
                            <div class="table-actions">
                                <button onclick="FortiLuceneDB.exportSavedQueries()">Export</button>
                                <button onclick="FortiLuceneDB.importSavedQueries()">Import</button>
                            </div>
                        ` : ''}
                        <div class="table-wrapper">
                            <table>
                                <tr>
                                    <th>Family Friendly Query</th>
                                    <th>Built-In Query</th>
                                    <th>Actions</th>
                                </tr>
                `;
                data[tableName].forEach(query => {
                    const encodedQuery = encodeURIComponent(query.BuiltInQuery);
                    content += `
                    <tr>
                        <td>${escapeHtml(query.FamilyFriendlyQuery)}</td>
                        <td>${escapeHtml(query.BuiltInQuery)}</td>
                        <td>
                            <button onclick="editQuery('${tableName}', ${query.ID}, 'name')">Edit Query Name</button>
                            ${tableName === 'SavedQueries' ? `
                                <button onclick="editQuery('${tableName}', ${query.ID}, 'query')">Edit Query</button>
                                <button onclick="deleteQuery('${tableName}', ${query.ID})">Delete</button>
                                <button onclick="FortiLuceneDB.copyQuery('${encodedQuery}')">Copy</button>
                            ` : ''}
                        </td>
                    </tr>
                    `;
                });
            
            content += `
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }
        databaseContent.innerHTML = content;
    
        // Add event listeners to table headers
        document.querySelectorAll('.table-header').forEach(header => {
            header.addEventListener('click', function() {
                toggleTable(this.getAttribute('data-table'));
            });
        });
    }
    

    function escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }



    window.editQuery = function(tableName, queryId, editType) {
        const row = event.target.closest('tr');
        const familyFriendly = row.cells[0].textContent;
        const builtIn = row.cells[1].textContent;
    
        if (editType === 'name') {
            showModal('Enter new Family Friendly Query', familyFriendly, (newFamilyFriendly) => {
                if (newFamilyFriendly) {
                    updateQuery(tableName, queryId, newFamilyFriendly, builtIn);
                    showToast('New Family Friendly Query Name Updated');
                }
            });
        } else if (editType === 'query') {
            // Close the database editor modal
            const databaseEditor = document.getElementById('database-editor');
            if (databaseEditor) {
                databaseEditor.style.display = 'none';
            }
    
            // Populate the query builder
            if (typeof window.FortiLucene.populateQueryBuilder === 'function') {
                window.FortiLucene.populateQueryBuilder(builtIn);
            } else {
                console.error('populateQueryBuilder function not found');
            }
    
            // Optionally, scroll to the query builder
            const queryBuilderContainer = document.getElementById('query-builder-container');
            if (queryBuilderContainer) {
                queryBuilderContainer.scrollIntoView({behavior: 'smooth'});
            }
    
            // Re-enable the buttons
            enableButtons();
        }
    };

    function enableButtons() {
        const threatHuntingBtn = document.getElementById('threat-hunting-btn');
        const threatIntelBtn = document.getElementById('threat-intel-btn');
        const kqlHuntingBtn = document.getElementById('kql-hunting-btn');
        
        if (threatHuntingBtn) {
            threatHuntingBtn.classList.remove('button-disabled');
        }
        if (threatIntelBtn) {
            threatIntelBtn.classList.remove('button-disabled');
        }
        if (kqlHuntingBtn) {
            kqlHuntingBtn.classList.remove('button-disabled');
        }
    }

    function populateQueryBuilder(query) {
        if (typeof window.populateQueryBuilder === 'function') {
            window.populateQueryBuilder(query);
        } else {
            console.error('populateQueryBuilder function not found');
        }
    }


    
    
    // function copyQuery(query) {
    //     navigator.clipboard.writeText(query).then(function() {
    //     //    alert('Query copied to clipboard');
    //     }, function(err) {
    //         console.error('Could not copy text: ', err);
    //     });
    // }

//useless piece of brown stuff
    // function exportSavedQueries() {
    //     fetch('/export_saved_queries')
    //         .then(response => response.blob())
    //         .then(blob => {
    //             const url = window.URL.createObjectURL(blob);
    //             const a = document.createElement('a');
    //             a.style.display = 'none';
    //             a.href = url;
    //             const date = new Date();
    //             const fileName = `SavedQueries Export - ${date.toISOString().split('T')[0]} - ${date.toTimeString().split(' ')[0].replace(/:/g, '-')}.csv`;
    //             a.download = fileName;
    //             document.body.appendChild(a);
    //             a.click();
    //             window.URL.revokeObjectURL(url);
    //         })
    //         .catch(error => console.error('Error:', error));
    // }

//useless piece of brown stuff
    // function importSavedQueries() {
    //     const input = document.createElement('input');
    //     input.type = 'file';
    //     input.accept = '.csv';
    //     input.onchange = function(event) {
    //         const file = event.target.files[0];
    //         if (file) {
    //             const formData = new FormData();
    //             formData.append('file', file);
    //             fetch('/import_saved_queries', {
    //                 method: 'POST',
    //                 body: formData
    //             })
    //             .then(response => response.json())
    //             .then(data => {
    //                 if (data.success) {
    //                     alert('Queries imported successfully');
    //                     loadDatabaseContent();
    //                 } else {
    //                     alert('Error importing queries: ' + data.error);
    //                 }
    //             })
    //             .catch(error => console.error('Error:', error));
    //         }
    //     };
    //     input.click();
    // }


    function safeCopy(text, successMessage = 'Copied to clipboard!') {
        if (navigator.clipboard && window.isSecureContext) {
            // For HTTPS or localhost
            navigator.clipboard.writeText(text)
                .then(() => alert(successMessage))
                .catch(err => {
                    console.error('Failed to copy: ', err);
                    fallbackCopy(text, successMessage);
                });
        } else {
            // Fallback for HTTP
            fallbackCopy(text, successMessage);
        }
    }
    
    function fallbackCopy(text, successMessage) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";  // Avoid scrolling to bottom
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
    
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                alert(successMessage);
            } else {
                alert('Copying failed. Please copy the text manually: ' + text);
            }
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
            alert('Copying failed. Please copy the text manually: ' + text);
        }
    
        document.body.removeChild(textArea);
    }

    function updateQuery(tableName, queryId, familyFriendly, builtIn) {
        fetch('/edit_query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                table: tableName,
                id: queryId,
                familyFriendly: familyFriendly,
                builtIn: builtIn
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.loadDatabaseContent();
            } else {
                //alert('Error updating query: ' + data.error);
                showToast('Error updatting query: ' +data.error);
            }
        })
        .catch(error => console.error('Error:', error));
    }



    window.FortiLuceneDB = {
        copyQuery: function(encodedQuery) {
            const queryText = decodeURIComponent(encodedQuery);
            this.safeCopy(queryText, 'Query copied to clipboard');
        },
    
        safeCopy: function(text, successMessage = 'Copied to clipboard!') {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text)
                    .then(() => this.showToast(successMessage))
                    .catch(err => {
                        console.error('Failed to copy: ', err);
                        this.fallbackCopy(text, successMessage);
                    });
            } else {
                this.fallbackCopy(text, successMessage);
            }
        },
    
        fallbackCopy: function(text, successMessage) {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
    
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    this.showToast(successMessage);
                } else {
                    this.showToast('Copying failed. Please copy the text manually.');
                }
            } catch (err) {
                console.error('Fallback: Oops, unable to copy', err);
                this.showToast('Copying failed. Please copy the text manually.');
            }
    
            document.body.removeChild(textArea);
        },
    
        showToast: function(message, duration = 3000) {
            if (window.showToast) {
                window.showToast(message, duration);
            } else {
                console.warn('showToast function not found. Falling back to alert.');
                alert(message);
            }
        },
        //Old copy function, removed because its not functional when project is published on server, the program doesnt have access to client's clipboard in order to copy data.
        // copyQuery: function(encodedQuery) {
        //     const queryText = decodeURIComponent(encodedQuery);
        //     navigator.clipboard.writeText(queryText)
        //         .then(function() {
        //             alert('Query copied to clipboard');
        //         })
        //         .catch(function(err) {
        //             console.error('Could not copy text: ', err);
        //             alert('Failed to copy query. Please try again.');
        //         });
        // },
        exportSavedQueries: function() {
            fetch('/export_saved_queries')
                .then(response => response.blob())
                .then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    const date = new Date();
                    const fileName = `SavedQueries Export - ${date.toISOString().split('T')[0]} - ${date.toTimeString().split(' ')[0].replace(/:/g, '-')}.csv`;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                })
                .catch(error => console.error('Error:', error));
        },
    
        importSavedQueries: function() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv';
            input.onchange = function(event) {
                const file = event.target.files[0];
                if (file) {
                    const formData = new FormData();
                    formData.append('file', file);
                    fetch('/import_saved_queries', {
                        method: 'POST',
                        body: formData
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            //alert('Queries imported successfully');
                            showToast('Queries Imported Successfully');
                            loadDatabaseContent();
                        } else {
                            //alert('Error importing queries: ' + data.error);
                            showToast('Error Importing Queries' + data.error);
                        }
                    })
                    .catch(error => console.error('Error:', error));
                }
            };
            input.click();
        }
    };



    function toggleTable(tableName) {
        const content = document.getElementById(`${tableName}-content`);
        const header = document.querySelector(`.table-header[data-table="${tableName}"]`);
        if (content.style.display === 'none') {
            content.style.display = 'block';
            header.innerHTML = `${tableName} ⤴`;
        } else {
            content.style.display = 'none';
            header.innerHTML = `${tableName} ⤵`;
        }
    }


    //old
    // window.editQuery = function(tableName, queryId, editType) {
    //     const row = event.target.closest('tr');
    //     const familyFriendly = row.cells[0].textContent;
    //     const builtIn = row.cells[1].textContent;
    
    //     if (editType === 'query') {
    //         // Close the database editor modal
    //         const databaseEditor = document.getElementById('database-editor');
    //         if (databaseEditor) {
    //             databaseEditor.style.display = 'none';
    //         }
    
    //         // Populate the query builder
    //         if (typeof window.FortiLucene.populateQueryBuilder === 'function') {
    //             window.FortiLucene.populateQueryBuilder(builtIn);
    //         } else {
    //             console.error('populateQueryBuilder function not found');
    //         }
    
    //         // Re-enable the buttons
    //         enableButtons();
    
    //         // Optionally, scroll to the query builder
    //         const queryBuilderContainer = document.getElementById('query-builder-container');
    //         if (queryBuilderContainer) {
    //             queryBuilderContainer.scrollIntoView({behavior: 'smooth'});
    //         }
    //     }
    // };


    window.deleteQuery = function(tableName, queryId) {
        if (tableName !== 'SavedQueries') {
            showToast('Deletion is only allowed for SavedQueries table.');
            return;
        }
    
        showModal('Are you sure you want to delete this query?', undefined, (confirmed) => {
            if (confirmed) {
                fetch('/delete_query', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        table: tableName,
                        id: queryId
                    }),
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showToast('Query deleted successfully');
                        loadDatabaseContent();
                    } else {
                        showToast('Error deleting query: ' + data.error);
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showToast('Error deleting query');
                });
            }
        });
    };

    function showModal(title, defaultValue, callback) {
        const modal = document.getElementById('custom-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalInput = document.getElementById('modal-input');
        const modalCancel = document.getElementById('modal-cancel');
        const modalConfirm = document.getElementById('modal-confirm');
    
        if (!modal || !modalTitle || !modalInput || !modalCancel || !modalConfirm) {
            console.error('Modal elements not found');
            return;
        }
    
        modalTitle.textContent = title;
        
        // Determine if this is an input dialog or a confirmation dialog
        const isInputDialog = defaultValue !== undefined;
        
        if (isInputDialog) {
            modalInput.value = defaultValue;
            modalInput.style.display = 'block';
            modalConfirm.textContent = 'Save';
        } else {
            modalInput.style.display = 'none';
            modalConfirm.textContent = 'Confirm';
        }
        
        modal.style.display = 'block';
    
        modalCancel.onclick = function() {
            modal.style.display = 'none';
            callback(null);
        }
    
        modalConfirm.onclick = function() {
            modal.style.display = 'none';
            if (isInputDialog) {
                callback(modalInput.value);
            } else {
                callback(true);
            }
        }
    
        window.onclick = function(event) {
            if (event.target == modal) {
                modal.style.display = 'none';
                callback(null);
            }
        }
    }

    function saveCustomQuery(name, query) {
        fetch('/save_custom_query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, query }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('Query saved successfully!');
            } else {
                showToast('Error saving query: ' + data.error);
            }
        })
        .catch(error => console.error('Error:', error));
    }
});