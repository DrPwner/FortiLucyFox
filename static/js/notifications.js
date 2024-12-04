//static/js/notifications.js

window.showToast = function(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%) translateY(-100%)';
    toast.style.backgroundColor = '#333';
    toast.style.color = '#fff';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '5px';
    toast.style.zIndex = '10000';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    
    document.body.appendChild(toast);
    
    // Trigger a reflow to enable the transition
    toast.offsetHeight;
    
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-100%)';
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300); // Wait for the transition to finish before removing the element
    }, duration);
};
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