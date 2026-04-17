import { db } from "./firebase-config.js";
import { collection, getDocs, addDoc, serverTimestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// State
let products = [];
let categories = ['Electronics', 'Hardware', 'Tools', 'Accessories']; // Fallback
let cart = JSON.parse(localStorage.getItem('mb_cart') || '[]');
let activeProductToAdded = null;

// DOM Elements
const productsContainer = document.getElementById('products-container');
const categoryFilters = document.getElementById('category-filters');
const searchInput = document.getElementById('search-input');
const currentCategoryTitle = document.getElementById('current-category-title');

// Cart DOM
const cartBtn = document.getElementById('cart-btn');
const cartOverlay = document.getElementById('cart-overlay');
const cartSidebar = document.getElementById('cart-sidebar');
const closeCartBtn = document.getElementById('close-cart-btn');
const cartItemsContainer = document.getElementById('cart-items-container');
const cartTotalItems = document.getElementById('cart-total-items');
const cartCount = document.getElementById('cart-count');
const requestQuoteBtn = document.getElementById('request-quote-btn');
const emptyCartMsg = document.getElementById('empty-cart-msg');

// Product Details Modal DOM
const productModal = document.getElementById('product-modal');
const closeProductModal = document.getElementById('close-product-modal');
const pdImg = document.getElementById('pd-img');
const pdName = document.getElementById('pd-name');
const pdCategory = document.getElementById('pd-category');
const pdPrice = document.getElementById('pd-price');
const pdDesc = document.getElementById('pd-desc');
const pdQtyInput = document.getElementById('pd-qty-input');
const pdQtyInc = document.getElementById('pd-qty-inc');
const pdQtyDec = document.getElementById('pd-qty-dec');
const pdAddBtn = document.getElementById('pd-add-btn');

// Enquiry Modal DOM
const enquiryModal = document.getElementById('enquiry-modal');
const closeEnquiryModal = document.getElementById('close-enquiry-modal');
const enquiryForm = document.getElementById('enquiry-form');

// Initialization
async function init() {
    updateCartUI();
    setupEventListeners();
    await fetchCategories();
    await fetchProducts();
}

async function fetchCategories() {
    try {
        const catDoc = await getDoc(doc(db, "settings", "categories"));
        if (catDoc.exists() && catDoc.data().list) {
            categories = catDoc.data().list;
        }
    } catch (e) {
        console.warn("Could not fetch dynamic categories. Using fallbacks. (Check Firestore Rules if this is a real project)", e);
    }
    renderCategories();
}

function renderCategories() {
    document.getElementById('loading-cats')?.remove();
    let html = `<button class="active" data-category="all">All Products</button>`;
    categories.forEach(cat => {
        html += `<button data-category="${cat.toLowerCase()}">${cat}</button>`;
    });
    categoryFilters.innerHTML = html;

    // Attach events
    categoryFilters.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            categoryFilters.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const category = e.target.getAttribute('data-category');
            if (category === 'all') {
                currentCategoryTitle.innerText = "All Products";
                renderProducts(products);
            } else {
                currentCategoryTitle.innerText = e.target.innerText;
                renderProducts(products.filter(p => p.category.toLowerCase() === category));
            }
        });
    });
}

async function fetchProducts() {
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        products = [];
        querySnapshot.forEach((doc) => {
            products.push({ id: doc.id, ...doc.data() });
        });
        
        if (products.length === 0) {
            productsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 50px;">No products found in the database.</div>`;
            return;
        }
    } catch (e) {
        console.error("Firestore Error:", e);
        if (typeof e.message === "string" && e.message.includes("Missing or insufficient permissions")) {
            productsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: #dc3545; border: 1px solid #dc3545; border-radius: 8px;">
                <strong>Database Access Denied!</strong><br>
                Please update your Firebase Firestore Security Rules.<br>
                Go to Firebase Console -> Firestore Database -> Rules -> set <code>allow read, write: if true;</code>
            </div>`;
        } else {
            productsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #dc3545; padding: 50px;">Failed to load products. Check your Firebase Config.</div>`;
        }
        return;
    }
    renderProducts(products);
}

function renderProducts(productsToRender) {
    if (productsToRender.length === 0) {
        productsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No products found in this category.</div>`;
        return;
    }

    productsContainer.innerHTML = productsToRender.map(product => {
        // Robust check for out of stock status
        const isOutOfStock = product.inStock === false || product.inStock === "false";
        
        return `
        <div class="product-card ${isOutOfStock ? 'out-of-stock' : ''}" onclick="${isOutOfStock ? "alert('Selected item is currently out of stock.')" : `openProductModal('${product.id}')`}">
            <div class="product-img-wrapper">
                <img src="${product.imageUrl || 'https://via.placeholder.com/200?text=No+Image'}" alt="${product.name}" class="product-img" loading="lazy">
            </div>
            <div class="product-info">
                <div class="product-category">${product.category}</div>
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price">${product.price > 0 ? '₹' + Number(product.price).toLocaleString() : 'Price on Quote'}</div>
                <button class="btn-secondary" style="margin-top: 15px; width: 100%;" ${isOutOfStock ? 'disabled' : ''}>
                    ${isOutOfStock ? 'Sold Out' : 'View Details'}
                </button>
            </div>
        </div>
        `;
    }).join('');
}

// Product Details Modal
window.openProductModal = (id) => {
    const p = products.find(x => x.id === id);
    if(!p) return;
    
    activeProductToAdded = p;
    pdImg.src = p.imageUrl || 'https://via.placeholder.com/400?text=No+Image';
    pdName.innerText = p.name;
    pdCategory.innerText = p.category;
    pdPrice.innerText = p.price > 0 ? '₹' + p.price.toLocaleString() : 'Price on Quote';
    pdDesc.innerText = p.description || "No description provided.";
    pdQtyInput.value = 1;
    
    productModal.classList.add('active');
};

pdQtyInc.addEventListener('click', () => { pdQtyInput.value = parseInt(pdQtyInput.value) + 1; });
pdQtyDec.addEventListener('click', () => { if(parseInt(pdQtyInput.value) > 1) pdQtyInput.value = parseInt(pdQtyInput.value) - 1; });

pdAddBtn.addEventListener('click', () => {
    if (!activeProductToAdded) return;
    const qty = parseInt(pdQtyInput.value);
    if(qty < 1) return;
    
    addToCart(activeProductToAdded, qty);
    productModal.classList.remove('active');
});

closeProductModal.addEventListener('click', () => {
    productModal.classList.remove('active');
});

// Cart & Overlay
cartBtn.addEventListener('click', () => {
    cartSidebar.classList.add('open');
    cartOverlay.classList.add('active');
});

[closeCartBtn, cartOverlay].forEach(el => {
    el.addEventListener('click', () => {
        cartSidebar.classList.remove('open');
        cartOverlay.classList.remove('active');
    });
});

function addToCart(product, qty) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
        existing.qty += qty;
    } else {
        cart.push({ ...product, qty: qty });
    }
    saveCart();
    updateCartUI();
    showToast(`Added ${qty} x ${product.name} to cart`, 'success');
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    saveCart();
    updateCartUI();
}

function saveCart() { localStorage.setItem('mb_cart', JSON.stringify(cart)); }

function updateCartUI() {
    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    cartCount.innerText = totalQty;
    cartTotalItems.innerText = totalQty;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = emptyCartMsg.outerHTML;
        document.getElementById('empty-cart-msg').style.display = 'block';
        requestQuoteBtn.style.opacity = '0.5';
        requestQuoteBtn.style.pointerEvents = 'none';
        return;
    }

    requestQuoteBtn.style.opacity = '1';
    requestQuoteBtn.style.pointerEvents = 'all';

    cartItemsContainer.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div style="display:flex; gap:12px; align-items:center; flex:1;">
                <img src="${item.imageUrl || 'https://via.placeholder.com/60'}" style="width:50px; height:50px; object-fit:cover; border-radius:8px;">
                <div style="flex:1;">
                    <div class="cart-item-title" style="font-size:0.9rem; margin-bottom:4px;">${item.name}</div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="qty-btn-group" style="display:flex; align-items:center; background:rgba(255,255,255,0.05); border-radius:4px; padding:2px;">
                            <button class="cart-qty-btn minus" data-id="${item.id}" style="background:none; border:none; color:#fff; padding:2px 8px; cursor:pointer;">-</button>
                            <span style="font-size:0.85rem; min-width:20px; text-align:center;">${item.qty}</span>
                            <button class="cart-qty-btn plus" data-id="${item.id}" style="background:none; border:none; color:#fff; padding:2px 8px; cursor:pointer;">+</button>
                        </div>
                        <span style="font-size:0.75rem; color:var(--text-muted);">${item.price > 0 ? '₹' + item.price.toLocaleString() : 'Price on Quote'}</span>
                    </div>
                </div>
            </div>
            <button class="remove-btn" data-id="${item.id}" style="background:none; border:none; color:#ff4d4d; cursor:pointer; padding:5px;"><i class='bx bx-trash'></i></button>
        </div>
    `).join('');

    // Attach quantity events
    document.querySelectorAll('.cart-qty-btn.minus').forEach(btn => 
        btn.addEventListener('click', (e) => changeQty(e.currentTarget.dataset.id, -1))
    );
    document.querySelectorAll('.cart-qty-btn.plus').forEach(btn => 
        btn.addEventListener('click', (e) => changeQty(e.currentTarget.dataset.id, 1))
    );

    document.querySelectorAll('.remove-btn').forEach(btn => 
        btn.addEventListener('click', (e) => removeFromCart(e.currentTarget.dataset.id))
    );
}

function changeQty(id, delta) {
    const item = cart.find(x => x.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty < 1) {
        removeFromCart(id);
    } else {
        saveCart();
        updateCartUI();
    }
}

// Enquiry Form
requestQuoteBtn.addEventListener('click', () => {
    cartSidebar.classList.remove('open');
    cartOverlay.classList.remove('active');
    enquiryModal.classList.add('active');
});

closeEnquiryModal.addEventListener('click', () => {
    enquiryModal.classList.remove('active');
});

enquiryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnText = document.getElementById('submit-text');
    const loader = document.getElementById('submit-loader');
    
    btnText.style.display = 'none';
    loader.style.display = 'block';

    const requestData = {
        customer: {
            name: document.getElementById('c-name').value,
            company: document.getElementById('c-company').value,
            email: document.getElementById('c-email').value,
            phone: document.getElementById('c-phone').value,
            address: document.getElementById('c-address').value,
            notes: document.getElementById('c-notes').value,
        },
        items: cart.map(item => ({ id: item.id, name: item.name, price: item.price, qty: item.qty })),
        status: 'pending',
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "quotation_requests"), requestData);
        showToast('Enquiry submitted successfully! We will contact you soon.', 'success');
        cart = [];
        saveCart();
        updateCartUI();
        enquiryModal.classList.remove('active');
        enquiryForm.reset();
    } catch (error) {
        console.error(error);
        
        if (error.message && error.message.includes("permissions")) {
            showToast('Permission Denied: Please update Firestore Rules.', 'error');
        } else {
            showToast('Failed to submit request. Check database connection.', 'error');
        }
    } finally {
        btnText.style.display = 'block';
        loader.style.display = 'none';
    }
});

function setupEventListeners() {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query.trim() !== '') {
            currentCategoryTitle.innerText = "Search Results";
            categoryFilters.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        } else {
            currentCategoryTitle.innerText = "All Products";
            categoryFilters.querySelector('[data-category="all"]')?.classList.add('active');
        }
        
        renderProducts(products.filter(p => 
            p.name.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query))
        ));
    });
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class='bx ${type === 'success' ? 'bxs-check-circle' : 'bxs-error-circle'}'></i> <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

init();
