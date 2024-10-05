let cart = [];

function addToCart(itemId, itemName, itemPrice) {


        // const name="btn"+itemId;
        // document.getElementById(name).innerHTML = "Added";

    const existingItem = cart.find(item => item.item_id === itemId);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ item_id: itemId, item_name: itemName, price: itemPrice, quantity: 1 });
    }

    //document.getElementById("btn"+itemId).innerHTML = "Added";


    // if(!existingItem){
    //     cart.push({ item_id: itemId, item_name: itemName, price: itemPrice, quantity: 1 });
    //     document.getElementById("btn"+itemId).innerHTML = "Added";
    // }
    
    updateCartDisplay();
    updateButtonState(itemId);
    saveCartToLocalStorage();

    // New code for incrementing cart count and flashing button
    incrementCartCount();
    //flashButton(itemId);
}

function updateCartDisplay() {
    const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
    document.getElementById("cart-number-count").innerHTML = cartCount;
}

function updateButtonState(itemId) {
    //flashButton(itemId);
    const button = document.getElementById(`btn${itemId}`);
    button.innerHTML = "Added";
    button.disabled = true;
}

function openMyCart() {
    const queryParams = new URLSearchParams({
        cart: JSON.stringify(cart)
    }).toString();
    
    window.location.href = `/cart?${queryParams}`;
}

// Initialize cart from localStorage on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartDisplay();
        cart.forEach(item => updateButtonState(item.item_id));
    }
});

// Save cart to localStorage whenever it changes
function saveCartToLocalStorage() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// New function to increment cart count
function incrementCartCount() {
    const cartCountElement = document.getElementById('cart-number-count');
    let currentCount = parseInt(cartCountElement.textContent, 10);
    cartCountElement.textContent = currentCount + 1;
}

// New function to flash button red
function flashButton(itemId) {
    const button = document.getElementById(`btn${itemId}`);
    button.style.transition = 'background-color 0.2s';
    button.style.backgroundColor = 'red';
    setTimeout(() => {
        button.style.backgroundColor = '';
    }, 1000);
}
