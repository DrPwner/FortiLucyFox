document.addEventListener('DOMContentLoaded', function() {
    const threatIntelBtn = document.getElementById('threat-intel-btn');
    const threatIntelModal = document.getElementById('threat-intel-modal');
    const closeModal = threatIntelModal.querySelector('.close');
    //const threatIntelContent = document.getElementById('threat-intel-content');
    const searchInput = document.getElementById('ioc-search-input');
    const searchResults = document.getElementById('ioc-search-results');
    const addIocBtn = document.getElementById('add-ioc-btn');
    const addIocForm = document.getElementById('add-ioc-form');
    const bulkImportBtn = document.getElementById('bulk-import-btn');
    const bulkImportInput = document.getElementById('bulk-import-input');
    const closeAddIocForm = document.querySelector('#add-ioc-form .close-form');
    let currentQuery = '';
    let currentOffset = 0;
    let hasMore = false;

    threatIntelBtn.addEventListener('click', function() {
        threatIntelModal.style.display = 'block';
    });

    closeAddIocForm.addEventListener('click', function() {
        addIocForm.style.display = 'none';
    });

    closeModal.addEventListener('click', function() {
        threatIntelModal.style.display = 'none';
    });

    searchInput.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            currentQuery = this.value;
            currentOffset = 0;
            searchIocs(currentQuery);
        }
    });
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchIocs(this.value);
        }
    });

    addIocBtn.addEventListener('click', function() {
        addIocForm.style.display = 'block';
    });

    addIocForm.addEventListener('submit', function(e) {
        e.preventDefault();
        addIoc();
    });

    bulkImportBtn.addEventListener('click', function() {
        bulkImportInput.click();
    });

    bulkImportInput.addEventListener('change', function(e) {
        bulkImportIocs(e.target.files[0]);
    });


    function searchIocs(query) {
        fetch(`/search_iocs?query=${encodeURIComponent(query)}`)
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw err; });
                }
                return response.json();
            })
            .then(data => {
                console.log('Search results:', data);
                if (data.error) {
                    throw new Error(data.error);
                }
                displayResults(data.results, true);
                hasMore = data.has_more;
                updateLoadMoreButton();
            })
            .catch(error => {
                console.error('Error:', error);
                searchResults.innerHTML = `<p>Error: ${error.message || 'An unknown error occurred'}</p>`;
                updateLoadMoreButton(false);
            });
    }


    function loadMoreResults() {
        currentOffset += 100;
        console.log('Loading more results. Query:', currentQuery, 'Offset:', currentOffset);
        fetch(`/get_more_results?query=${encodeURIComponent(currentQuery)}&offset=${currentOffset}`)
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw err; });
                }
                return response.json();
            })
            .then(data => {
                console.log('Additional results:', data);
                if (data.error) {
                    throw new Error(data.error);
                }
                displayResults(data.results, false);
                hasMore = data.has_more;
                updateLoadMoreButton();
            })
            .catch(error => {
                console.error('Error:', error);
                searchResults.innerHTML += `<p>Error loading more results: ${error.message || 'An unknown error occurred'}</p>`;
                updateLoadMoreButton(false);
            });
    }


    function displayResults(results, clearPrevious = true) {
        if (clearPrevious) {
            searchResults.innerHTML = '';
        }

        // Remove existing Load More button if it exists
        const existingLoadMoreBtn = searchResults.querySelector('.load-more-btn');
        if (existingLoadMoreBtn) {
            existingLoadMoreBtn.remove();
        }

        if (!results || results.length === 0) {
            searchResults.innerHTML += '<p>No results found.</p>';
            return;
        }

        results.forEach(ioc => {
            const iocElement = document.createElement('div');
            iocElement.className = 'ioc-result';
            iocElement.innerHTML = `
                <p><strong>IOC Type:</strong> ${ioc.ioc_type || 'N/A'}</p>
                <p><strong>IOC Value:</strong> ${ioc.ioc_value || 'N/A'}</p>
                <p><strong>Threat Type:</strong> ${ioc.threat_type || 'N/A'}</p>
                <p><strong>Malware:</strong> ${ioc.malware || 'N/A'}</p>
                <p><strong>Malware Alias:</strong> ${ioc.malware_alias || 'N/A'}</p>
                <p><strong>Malware Printable:</strong> ${ioc.malware_printable || 'N/A'}</p>
                <p><strong>First Seen:</strong> ${ioc.first_seen_utc || 'N/A'}</p>
                <p><strong>Last Seen:</strong> ${ioc.last_seen_utc || 'N/A'}</p>
                <p><strong>Tags:</strong> ${ioc.tags || 'N/A'}</p>
                <p><strong>Reference:</strong> ${ioc.reference || 'N/A'}</p>
                <p><strong>Confidence Level:</strong> ${ioc.confidence_level || 'N/A'}%</p>
            `;
            searchResults.appendChild(iocElement);
        });

        // Add Load More button after all results
        updateLoadMoreButton();
    }
    

    function updateLoadMoreButton(show = hasMore) {
        let loadMoreBtn = searchResults.querySelector('.load-more-btn');
        
        if (!show) {
            if (loadMoreBtn) {
                loadMoreBtn.remove();
            }
        } else {
            if (!loadMoreBtn) {
                loadMoreBtn = document.createElement('button');
                loadMoreBtn.textContent = 'Load More';
                loadMoreBtn.className = 'load-more-btn';
                loadMoreBtn.addEventListener('click', loadMoreResults);
            }
            // Always append the button to the end of searchResults
            searchResults.appendChild(loadMoreBtn);
        }
    }



    function addIoc() {
        const formData = new FormData(addIocForm);
        const iocData = Object.fromEntries(formData.entries());
    
        fetch('/add_ioc', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(iocData),
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showToast(data.error);
            } else {
                showToast('IOC added successfully');
                addIocForm.reset();
                addIocForm.style.display = 'none';
                // Optionally, refresh the search results
                searchIocs(searchInput.value);
            }
        })
        .catch(error => console.error('Error:', error));
    }

    function bulkImportIocs(file) {
        const formData = new FormData();
        formData.append('file', file);
    
        fetch('/bulk_import_iocs', {
            method: 'POST',
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showToast(data.error);
            } else {
                showToast('Bulk import successful');
            }
        })
        .catch(error => console.error('Error:', error));
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
});