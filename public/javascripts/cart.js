let cart = [];
let debounceTimers = {};
let currentCanteen = null;

// Function to add item to cart
function addToCart(itemId, itemName, itemPrice) {
    // Get current canteen name from the page
    const titleElement = document.querySelector('.h2-title');
    if (!titleElement) {
        console.error('Current canteen name not found.');
        return;
    }

    currentCanteen = titleElement.textContent.trim();

    // Check if there is an existing canteen in the cart
    const storedCanteen = localStorage.getItem('currentCanteen');
    if (storedCanteen && storedCanteen !== currentCanteen) {
        if (confirm(`Your cart contains items from ${storedCanteen}. Would you like to clear it and add items from ${currentCanteen}?`)) {
            cart = [];
            localStorage.removeItem(`cart_${storedCanteen}`);
            localStorage.setItem('currentCanteen', currentCanteen);
        } else {
            return;
        }
    } else if (!storedCanteen) {
        localStorage.setItem('currentCanteen', currentCanteen);
    }

    // Get the button and check if item is already in cart
    const button = document.getElementById(`btn${itemId}`);
    if (!button) {
        console.error(`Button with id btn${itemId} not found.`);
        return;
    }

    // Initialize cart from localStorage
    cart = localStorage.getItem(`cart_${currentCanteen}`) ? JSON.parse(localStorage.getItem(`cart_${currentCanteen}`)) : [];
    
    const existingItem = cart.find(item => item.item_id === itemId);
    if (existingItem) {
        // If item exists, remove it
        cart = cart.filter(item => item.item_id !== itemId);
        button.innerHTML = '<i class="uil uil-plus"></i>';
        button.classList.remove('added');
    } else {
        // If item doesn't exist, add it
        const productCard = button.closest('.dish-box');
        if (!productCard) {
            console.error(`Product card for item ${itemId} not found.`);
            return;
        }
        const imageElement = productCard.querySelector('.dist-img img');
        if (!imageElement) {
            console.error(`Image element for item ${itemId} not found.`);
            return;
        }
        const imageUrl = imageElement.src;

        cart.push({
            item_id: itemId,
            item_name: itemName,
            price: parseFloat(itemPrice),
            quantity: 1,
            item_img: imageUrl
        });
        button.innerHTML = '<i class="uil uil-minus"></i>';
        button.classList.add('added');
    }

    // Save cart to localStorage
    localStorage.setItem(`cart_${currentCanteen}`, JSON.stringify(cart));

    // Update cart display
    updateCartDisplay();
}

// Function to remove or decrement item from cart
function removeFromCart(itemId) {
    currentCanteen = localStorage.getItem('currentCanteen');
    if (!currentCanteen) {
        console.error('No canteen selected.');
        return;
    }

    cart = localStorage.getItem(`cart_${currentCanteen}`) ? JSON.parse(localStorage.getItem(`cart_${currentCanteen}`)) : [];

    const existingItem = cart.find(item => item.item_id === itemId);
    if (existingItem) {
        existingItem.quantity -= 1;
        if (existingItem.quantity <= 0) {
            // Remove item from cart
            cart = cart.filter(item => item.item_id !== itemId);
            // Update button state on homepage
            updateButtonState(itemId, false);
        }
        // Update localStorage
        localStorage.setItem(`cart_${currentCanteen}`, JSON.stringify(cart));
        updateCartDisplay();
    } else {
        console.warn(`Item with ID ${itemId} not found in cart.`);
    }
}

// Function to update cart display count
function updateCartDisplay() {
    const totalQuantity = cart.reduce((total, item) => total + item.quantity, 0);
    const cartCountElement = document.getElementById("cart-number-count");
    if (cartCountElement) {
        cartCountElement.innerHTML = totalQuantity;
    }
}

// Function to open the cart page
function openMyCart() {
    window.location.href = '/cart';
}

// Function to clear cart
function clearCart() {
    const canteen = localStorage.getItem('currentCanteen');
    if (canteen) {
        localStorage.removeItem(`cart_${canteen}`);
        localStorage.removeItem('currentCanteen');
    }
    cart = [];
    updateCartDisplay();
}

// Initialize cart on page load
document.addEventListener('DOMContentLoaded', () => {
    const titleElement = document.querySelector('.h2-title');
    if (!titleElement) {
        console.error('Current canteen name not found.');
        return;
    }

    currentCanteen = titleElement.textContent.trim();

    // Load cart from localStorage
    cart = localStorage.getItem(`cart_${currentCanteen}`) ? JSON.parse(localStorage.getItem(`cart_${currentCanteen}`)) : [];

    // Initialize button states based on cart contents
    cart.forEach(item => {
        const button = document.getElementById(`btn${item.item_id}`);
        if (button) {
            button.innerHTML = '<i class="uil uil-minus"></i>';
            button.classList.add('added');
        }
    });

    updateCartDisplay();
});

