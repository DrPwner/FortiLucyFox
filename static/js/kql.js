// static/js/kql.js

document.addEventListener('DOMContentLoaded', function() {
    const kqlHuntingBtn = document.getElementById('kql-hunting-btn');
    const kqlHuntingModal = document.getElementById('kql-hunting-modal');
    const closeModal = kqlHuntingModal.querySelector('.close');
    const kqlHuntingContent = document.getElementById('kql-hunting-content');
    




    
    kqlHuntingBtn.addEventListener('click', function() {
        kqlHuntingModal.style.display = 'block';
        loadKQLThreatHuntingContent();
    });

    closeModal.addEventListener('click', function() {
        kqlHuntingModal.style.display = 'none';
    });

    window.onclick = function(event) {
        if (event.target == kqlHuntingModal) {
            kqlHuntingModal.style.display = 'none';
        }
    };

    function loadKQLThreatHuntingContent() {
        fetch('/get_kql_threat_hunting_tables')
            .then(response => response.json())
            .then(data => {
                displayKQLThreatHuntingContent(data);
            })
            .catch(error => console.error('Error:', error));
    }

    function displayKQLThreatHuntingContent(data) {
        let content = '<div id="kql-table-sidebar">';
        data.forEach(tableName => {
            content += `<div class="kql-sidebar-item" onclick="KQLThreatHunting.loadTableData('${tableName}')">${tableName}</div>`;
        });
        content += '</div><div id="kql-table-content"></div>';
        kqlHuntingContent.innerHTML = content;

        // Load the first table by default
        if (data.length > 0) {
            KQLThreatHunting.loadTableData(data[0]);
        }
    }

    window.KQLThreatHunting = {
        loadTableData: function(tableName) {
            if (tableName === 'Checked_KQL_Threat_Hunting_Queries') {
                this.loadCheckedQueriesTable();
                return;
            }
            fetch(`/get_kql_threat_hunting_data/${tableName}`)
                .then(response => response.json())
                .then(result => {
                    const tableContent = document.getElementById('kql-table-content');
                    if (result.error) {
                        tableContent.innerHTML = `<p>Error: ${result.error}</p>`;
                        return;
                    }
                    
                    const data = result.data;
                    let content = `
                        <h3>${tableName}</h3>
                        <p>${result.message}</p>
                    `;
                    
                    if (data.length > 0) {
                        const columns = ['id', 'Query_Text', 'Created_At', 'Completed', 'Hits'];
                        content += `
                            <table>
                                <tr>
                                    ${columns.map(col => `<th>${col}</th>`).join('')}
                                    <th>Actions</th>
                                </tr>
                        `;
                        data.forEach(query => {
                            content += `
                                <tr>
                                    ${columns.map(col => `<td>${query[col] || ''}</td>`).join('')}
                                    <td>
                                        <button onclick="KQLThreatHunting.copyQuery('${tableName}', ${query.id})">Copy</button>
                                        <button onclick="KQLThreatHunting.markAsComplete('${tableName}', ${query.id})">Mark Complete</button>

                                    </td>
                                </tr>
                            `;
                        });
                        content += '</table>';
                    }
                    tableContent.innerHTML = content;
                })
                .catch(error => {
                    console.error('Error:', error);
                    document.getElementById('kql-table-content').innerHTML = `<p>Error loading data: ${error.message}</p>`;
                });
        },

        loadCheckedQueriesTable: function() {
            fetch('/get_kql_threat_hunting_data/Checked_KQL_Threat_Hunting_Queries')
                .then(response => response.json())
                .then(result => {
                    const tableContent = document.getElementById('kql-table-content');
                    if (result.error) {
                        tableContent.innerHTML = `<p>Error: ${result.error}</p>`;
                        return;
                    }
                    
                    const data = result.data;
                    let content = `
                        <h3>Checked KQL Threat Hunting Queries</h3>
                        <p>${result.message}</p>
                    `;
                    
                    if (data.length > 0) {
                        const columns = ['id', 'Type', 'Date_Checked', 'Hits'];
                        content += `
                            <table>
                                <tr>
                                    ${columns.map(col => `<th>${col}</th>`).join('')}
                                </tr>
                        `;
                        data.forEach(query => {
                            content += `
                                <tr>
                                    ${columns.map(col => `<td>${query[col] || ''}</td>`).join('')}
                                </tr>
                            `;
                        });
                        content += '</table>';
                    }
                    tableContent.innerHTML = content;
                })
                .catch(error => {
                    console.error('Error:', error);
                    document.getElementById('kql-table-content').innerHTML = `<p>Error loading data: ${error.message}</p>`;
                });
        },

        copyQuery: function(tableName, queryId) {
            fetch(`/get_full_kql_query_text/${tableName}/${queryId}`)
                .then(response => response.json())
                .then(data => {
                    safeCopy(data.query_text, 'Query copied to clipboard');
                });
        },

        markAsComplete: function(tableName, queryId) {
            const modalContent = `
                <div style="background-color: white; padding: 20px; border-radius: 5px; width: 80%; max-width: 500px; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000;">
                    <h2>Record Query Results</h2>
                    <textarea id="query-results" rows="5" style="width: 100%; margin-bottom: 10px;" placeholder="Enter query results here..."></textarea>
                    <div style="text-align: right;">
                        <button id="save-results">Save</button>
                        <button id="cancel-results">Cancel</button>
                    </div>
                </div>
            `;
    
            const modalOverlay = document.createElement('div');
            modalOverlay.style.position = 'fixed';
            modalOverlay.style.top = '0';
            modalOverlay.style.left = '0';
            modalOverlay.style.width = '100%';
            modalOverlay.style.height = '100%';
            modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            modalOverlay.style.zIndex = '9999';
    
            modalOverlay.innerHTML = modalContent;
            document.body.appendChild(modalOverlay);
    
            const saveButton = modalOverlay.querySelector('#save-results');
            const cancelButton = modalOverlay.querySelector('#cancel-results');
            const textarea = modalOverlay.querySelector('#query-results');
    
            saveButton.onclick = () => {
                const results = textarea.value.trim();
                if (results === '') {
                    if (confirm("Are you sure there are no results from the selected threat hunting query?")) {
                        this.updateQueryStatus(tableName, queryId, 'Checked at ' + new Date().toLocaleString(), 'No hits');
                        document.body.removeChild(modalOverlay);
                        showToast('Query Marked As Complete');
                    }
                } else {
                    this.updateQueryStatus(tableName, queryId, 'Checked at ' + new Date().toLocaleString(), results);
                    document.body.removeChild(modalOverlay);
                    showToast('Query Marked As Complete');
                }
            };
    
            cancelButton.onclick = () => {
                document.body.removeChild(modalOverlay);
            };
    
            modalOverlay.onclick = function(event) {
                if (event.target === modalOverlay) {
                    document.body.removeChild(modalOverlay);
                }
            };
        },

        updateQueryStatus: function(tableName, queryId, completed, hits) {
            fetch('/update_kql_threat_hunting_query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    table_name: tableName,
                    query_id: queryId,
                    completed: completed,
                    hits: hits
                }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.loadTableData(tableName);  // Refresh the table
                } else {
                    showToast('Failed to update Query Status');
                }
            });
        }
    };
});