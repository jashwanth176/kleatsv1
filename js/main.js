// Handle page transitions
function handlePageTransition(fromPage, toPage) {
    // Immediately hide the from page
    fromPage.style.display = 'none';
    
    // Immediately show the to page
    toPage.style.display = 'block';
    
    // Immediately set the final position without any transition
    toPage.style.transform = 'none';
    toPage.style.opacity = '1';
}

// Handle page transitions with animation
function handlePageTransitionWithAnimation(fromPage, toPage) {
    // Immediately hide the from page
    fromPage.style.display = 'none';
    
    // Immediately show the to page
    toPage.style.display = 'block';
    
    // Immediately set the final position without any transition
    toPage.style.transform = 'none';
    toPage.style.opacity = '1';
}

// Handle page transitions with animation and cleanup
function handlePageTransitionWithAnimationAndCleanup(fromPage, toPage) {
    // Immediately hide the from page
    fromPage.style.display = 'none';
    
    // Immediately show the to page
    toPage.style.display = 'block';
    
    // Immediately set the final position without any transition
    toPage.style.transform = 'none';
    toPage.style.opacity = '1';
} 