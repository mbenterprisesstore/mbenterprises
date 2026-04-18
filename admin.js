import { db } from "./firebase-config.js";
import { collection, getDocs, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

let products = [];
let categories = [];
let quotes = [];
let activeQuote = null;
let currentQuoteTab = 'all';
let appSettings = { logo: '', address: '', contact: '', tax: 18, currency: '₹' };

// DOM
const authScreen = document.getElementById('auth-screen');
const loginForm = document.getElementById('login-form');
const navItems = document.querySelectorAll('.nav-item[data-target]');
const sections = document.querySelectorAll('.section');
const logoutBtn = document.getElementById('logout-btn');
const fbWarning = document.getElementById('firebase-warning');

// Category Selection
const addCatForm = document.getElementById('add-category-form');
const pCategorySelect = document.getElementById('p-category');

initAdmin();

function initAdmin() {
    // PIN Login
    if (localStorage.getItem('mb_admin_logged') === 'true') {
        authScreen.style.display = 'none';
        loadDashboardData();
    }

    loginForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const pinValue = document.getElementById('admin-pin').value.trim();
        if (pinValue === '1234') {
            localStorage.setItem('mb_admin_logged', 'true');
            authScreen.style.display = 'none';
            loadDashboardData();
        } else {
            document.getElementById('login-error').style.display = 'block';
        }
    });

    logoutBtn?.addEventListener('click', () => {
        localStorage.removeItem('mb_admin_logged');
        window.location.reload();
    });

    // Navigation logic
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            const target = item.getAttribute('data-target');

            const titleEl = document.getElementById('page-title');
            if (titleEl) titleEl.innerText = item.innerText.trim();

            sections.forEach(sec => sec.classList.remove('active'));
            const targetSection = document.getElementById(`section-${target}`);
            if (targetSection) targetSection.classList.add('active');

            if (target === 'stock') {
                renderStockList();
            }
        });
    });

    // Stock Tab Switching
    document.querySelectorAll('.stock-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.stock-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tab = btn.dataset.stockTab;
            document.querySelectorAll('.stock-view').forEach(v => v.style.display = 'none');
            const targetView = document.getElementById(`stock-view-${tab}`);
            if (targetView) targetView.style.display = 'block';

            renderStockList();
        });
    });

    // Modals
    document.getElementById('btn-add-product').addEventListener('click', () => {
        document.getElementById('product-form').reset();
        document.getElementById('p-id').value = '';
        document.getElementById('product-modal-title').innerText = 'Add New Product';
        document.getElementById('product-modal').classList.add('active');
    });

    document.getElementById('close-product-modal').addEventListener('click', () => {
        document.getElementById('product-modal').classList.remove('active');
    });

    document.getElementById('close-quote-modal').addEventListener('click', () => {
        document.getElementById('quote-modal').classList.remove('active');
    });

    // Form Submits
    document.getElementById('product-form').addEventListener('submit', handleSaveProduct);
    document.getElementById('update-quote-db-btn').addEventListener('click', saveQuoteUpdates);
    document.getElementById('download-quote-pdf-btn').addEventListener('click', downloadQuotePDF);
    addCatForm.addEventListener('submit', handleAddCategory);

    // Product Search Listener
    document.getElementById('admin-product-search')?.addEventListener('input', (e) => {
        renderProducts(e.target.value);
    });

    // Quote Tab Listeners
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentQuoteTab = btn.dataset.tab;
            renderQuotes();
        });
    });
}

// ----------------------------------------
// DATA LOADING
// ----------------------------------------

async function loadDashboardData() {
    fbWarning.style.display = 'none';
    
    // 1. Live Categories
    onSnapshot(doc(db, "settings", "categories"), (snap) => {
        if (snap.exists() && snap.data().list) {
            categories = snap.data().list;
            renderCategories();
        }
    });

    // 2. Live Products
    onSnapshot(collection(db, "products"), (snap) => {
        products = [];
        snap.forEach(d => products.push({ id: d.id, ...d.data() }));
        renderProducts();
        if (document.getElementById('section-stock').classList.contains('active')) {
            renderStockList();
        }
        updateStats();
    });

    // 3. Live Quotations
    onSnapshot(collection(db, "quotation_requests"), (snap) => {
        quotes = [];
        snap.forEach(d => quotes.push({ id: d.id, ...d.data() }));
        quotes.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        renderQuotes();
        updateDashboardStats();
        updateStats();
    });

    // 4. Live Settings
    onSnapshot(doc(db, "settings", "general"), (snap) => {
        if (snap.exists()) {
            appSettings = { ...appSettings, ...snap.data() };
            // Update UI fields in settings tab if they exist
            const logoEl = document.getElementById('s-logo');
            if(logoEl) {
                logoEl.value = appSettings.logo || '';
                document.getElementById('s-address').value = appSettings.address || '';
                document.getElementById('s-contact').value = appSettings.contact || '';
                document.getElementById('s-tax').value = appSettings.tax || 18;
                document.getElementById('s-currency').value = appSettings.currency || '₹';
                document.getElementById('s-upi-id').value = appSettings.upiId || '';
                document.getElementById('s-upi-name').value = appSettings.upiName || '';
            }
        }
    });
}

// Fetch data is now handled in real-time by Snapshot listeners in loadDashboardData()
async function fetchCategories() { }

function renderCategories() {
    // Admin Categories List
    const cont = document.getElementById('admin-categories-container');
    cont.innerHTML = categories.map((cat, idx) => `
        <div class="cat-tag">
            ${cat} <button type="button" onclick="deleteCategory(${idx})"><i class='bx bx-x'></i></button>
        </div>
    `).join('');

    // Product Form Categories Dropdown
    pCategorySelect.innerHTML = categories.map(cat => `<option value="${cat.toLowerCase()}">${cat}</option>`).join('');
}

async function handleAddCategory(e) {
    e.preventDefault();
    const newCat = document.getElementById('new-category-input').value.trim();
    if (!newCat) return;

    categories.push(newCat);
    try {
        await setDoc(doc(db, "settings", "categories"), { list: categories });
        document.getElementById('new-category-input').value = '';
        renderCategories();
    } catch (e) {
        alert("Failed to save category. Check Firebase Rules.");
        console.error(e);
    }
}

window.deleteCategory = async (idx) => {
    if (!confirm(`Delete category '${categories[idx]}'?`)) return;
    categories.splice(idx, 1);
    try {
        await setDoc(doc(db, "settings", "categories"), { list: categories });
        renderCategories();
    } catch (e) {
        alert("Failed to delete. Check Firebase Rules.");
    }
}

async function fetchProducts() { }

async function fetchQuotes() { }

function updateDashboardStats() {
    let totalRev = 0;
    let openCount = 0;
    let closedCount = 0;

    quotes.forEach(q => {
        totalRev += (q.amountPaid || 0);
        if (q.paymentStatus === 'Paid') {
            closedCount++;
        } else if (q.paymentStatus !== 'Cancelled' && q.paymentStatus !== 'Draft') {
            openCount++;
        }
    });

    document.getElementById('stat-revenue').innerText = `${appSettings.currency}${totalRev.toLocaleString()}`;
    document.getElementById('stat-pending').innerText = openCount;
    document.getElementById('stat-closed').innerText = closedCount;
}

function updateStats() {
    document.getElementById('stat-products').innerText = products.length;
    document.getElementById('stat-requests').innerText = quotes.length;

    const lowStockCount = products.filter(p => (p.stockQty || 0) <= 5).length;
    document.getElementById('stat-low-stock').innerText = lowStockCount;
}

// ----------------------------------------
// PRODUCTS LOGIC
// ----------------------------------------
function renderProducts(searchQuery = '') {
    const tbody = document.getElementById('admin-products-body');
    const filtered = products.filter(p => {
        const match = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.category.toLowerCase().includes(searchQuery.toLowerCase());
        return match;
    });

    tbody.innerHTML = filtered.map(p => `
        <tr>
            <td><img src="${p.imageUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;"></td>
            <td><strong>${p.name}</strong></td>
            <td>${p.category}</td>
            <td style="font-weight:bold;">₹${p.price.toLocaleString()}</td>
            <td style="color:#ef4444; background: rgba(239, 68, 68, 0.03);">₹${(p.purchasePrice || 0).toLocaleString()}</td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-weight:600; color: ${p.stockQty > 0 ? '#10b981' : '#ef4444'}">${p.stockQty || 0}</span>
                    <small style="color:var(--text-muted); font-size:0.7rem;">Units</small>
                </div>
            </td>
            <td>
                <button class="btn-icon" onclick="editProduct('${p.id}')"><i class='bx bx-edit'></i></button>
                <button class="btn-icon delete" onclick="deleteProduct('${p.id}')"><i class='bx bx-trash'></i></button>
            </td>
        </tr>
    `).join('');
}

window.editProduct = (id) => {
    const p = products.find(x => x.id === id);
    if (!p) return;
    document.getElementById('p-id').value = p.id;
    document.getElementById('p-name').value = p.name;
    document.getElementById('p-category').value = p.category;
    document.getElementById('p-desc').value = p.description;
    document.getElementById('p-price').value = p.price;
    document.getElementById('p-cost').value = p.purchasePrice || 0;
    document.getElementById('p-img').value = p.imageUrl || '';
    document.getElementById('p-stock').checked = p.inStock !== false;
    document.getElementById('p-stock-qty').value = p.stockQty || 0;
    document.getElementById('p-variant-name').value = p.variantName || '';
    document.getElementById('p-variants').value = p.variants ? p.variants.join(', ') : '';
    document.getElementById('product-modal-title').innerText = 'Edit Product';
    document.getElementById('product-modal').classList.add('active');
};

async function handleSaveProduct(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerHTML = 'Saving...';
    btn.disabled = true;

    const id = document.getElementById('p-id').value;
    const data = {
        name: document.getElementById('p-name').value,
        category: document.getElementById('p-category').value,
        description: document.getElementById('p-desc').value,
        price: document.getElementById('p-price').value ? Number(document.getElementById('p-price').value) : 0,
        purchasePrice: document.getElementById('p-cost').value ? Number(document.getElementById('p-cost').value) : 0,
        imageUrl: document.getElementById('p-img').value,
        inStock: document.getElementById('p-stock').checked,
        stockQty: document.getElementById('p-stock-qty').value ? Number(document.getElementById('p-stock-qty').value) : 0,
        variantName: document.getElementById('p-variant-name').value.trim(),
        variants: document.getElementById('p-variants').value.split(',').map(v => v.trim()).filter(v => v !== ""),
        createdAt: serverTimestamp()
    };

    try {
        if (id) {
            await updateDoc(doc(db, "products", id), data);
        } else {
            await addDoc(collection(db, "products"), data);
        }
        document.getElementById('product-modal').classList.remove('active');
        await fetchProducts(); // refresh
        updateStats();
    } catch (err) {
        alert("Failed to save product. Check permissions.");
        console.error(err);
    } finally {
        btn.innerHTML = 'Save Product';
        btn.disabled = false;
    }
}

window.deleteProduct = async (id) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
        await deleteDoc(doc(db, "products", id));
        await fetchProducts();
        updateStats();
    } catch (e) {
        alert("Failed to delete product.");
    }
}

// ----------------------------------------
// QUOTATIONS LOGIC
// ----------------------------------------
function renderQuotes() {
    const tbody = document.getElementById('admin-quotes-body');

    const filtered = quotes.filter(q => {
        if (currentQuoteTab === 'all') return true;

        const sub = q.items.reduce((acc, item) => acc + (item.price * item.qty), 0);
        const tax = sub * (appSettings.tax / 100);
        const total = sub + tax;
        const paid = q.amountPaid || 0;
        const balance = total - paid;

        if (currentQuoteTab === 'Partial') return balance > 0 && paid > 0 && q.paymentStatus !== 'Cancelled';
        if (currentQuoteTab === 'Hold') return q.paymentStatus === 'On Hold';

        return q.paymentStatus === currentQuoteTab || (!q.paymentStatus && currentQuoteTab === 'New');
    });

    tbody.innerHTML = filtered.map(q => {
        const d = (q.createdAt && q.createdAt.seconds) ? new Date(q.createdAt.seconds * 1000).toLocaleDateString() : 'New';

        // Calculate financial data
        const sub = q.items.reduce((acc, item) => acc + (item.price * item.qty), 0);
        const tax = sub * (appSettings.tax / 100);
        const total = sub + tax;
        const paid = q.amountPaid || 0;
        const balance = total - paid;

        let statusTag = '<span style="background:rgba(255,255,255,0.05); color:var(--text-muted); padding:4px 10px; border-radius:12px; font-size:0.75rem; border:1px solid var(--border-color);">New</span>';

        const s = q.paymentStatus;
        if (s === 'Paid') statusTag = '<span style="background:rgba(16,185,129,0.1); color:#10b981; padding:4px 10px; border-radius:12px; font-size:0.75rem; border:1px solid rgba(16,185,129,0.2);">Closed</span>';
        else if (s === 'On Hold') statusTag = '<span style="background:rgba(245,158,11,0.1); color:#f59e0b; padding:4px 10px; border-radius:12px; font-size:0.75rem; border:1px solid rgba(245,158,11,0.2);">Hold</span>';
        else if (s === 'Quote Sent') statusTag = '<span style="background:rgba(59,130,246,0.1); color:#3b82f6; padding:4px 10px; border-radius:12px; font-size:0.75rem; border:1px solid rgba(59,130,246,0.2);">Sent</span>';
        else if (s === 'Approved') statusTag = '<span style="background:rgba(16,185,129,0.1); color:#10b981; padding:4px 10px; border-radius:12px; font-size:0.75rem; border:1px solid #10b98180;">Approved</span>';
        else if (s === 'Draft') statusTag = '<span style="background:rgba(255,255,255,0.03); color:rgba(255,255,255,0.4); padding:4px 10px; border-radius:12px; font-size:0.75rem; border:1px solid var(--border-color);">Draft</span>';
        else if (s === 'Cancelled') statusTag = '<span style="background:rgba(239,68,68,0.1); color:#ef4444; padding:4px 10px; border-radius:12px; font-size:0.75rem; border:1px solid rgba(239,68,68,0.2);">Lost</span>';
        else if (s === 'Partial') statusTag = '<span style="background:rgba(124,58,237,0.1); color:var(--primary); padding:4px 10px; border-radius:12px; font-size:0.75rem; border:1px solid var(--primary);">Partial</span>';

        return `
            <tr>
                <td>${d}</td>
                <td><strong>${q.customer.name}</strong><br><small style="color:var(--text-muted);">${q.customer.phone}</small></td>
                <td>₹${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td style="color: #10b981;">₹${paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td style="color: ${balance > 0 ? '#ef4444' : '#10b981'}; font-weight: bold;">₹${Math.max(0, balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td>${statusTag}</td>
                <td>
                    <div style="display:flex; gap:5px;">
                        <button class="btn-primary" onclick="openQuoteModal('${q.id}')" style="padding: 6px 10px; font-size: 0.75rem;">Manage</button>
                        <button class="btn-secondary" onclick="copyQuoteLink('${q.id}')" style="padding: 6px 10px; font-size: 0.75rem; background:rgba(59,130,246,0.1); color:#3b82f6; border:1px solid #3b82f633;">Link</button>
                        <button class="btn-icon delete" onclick="deleteQuote('${q.id}')" style="width:30px; height:30px;"><i class='bx bx-trash'></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.deleteQuote = async (id) => {
    if (!confirm("Delete this quotation request completely?")) return;
    try {
        await deleteDoc(doc(db, "quotation_requests", id));
        await fetchQuotes();
        updateStats();
    } catch (e) {
        alert("Failed to delete.");
    }
}

window.copyQuoteLink = (id) => {
    const url = window.location.href.split('admin.html')[0] + 'quote.html?id=' + id;
    navigator.clipboard.writeText(url).then(() => {
        alert("Customer Approval Link copied to clipboard!\n\nYou can now share this on WhatsApp or Email.");
    });
};

window.openQuoteModal = (id) => {
    activeQuote = quotes.find(x => x.id === id);
    if (!activeQuote) return;

    // Set editable fields
    document.getElementById('c-edit-name').value = activeQuote.customer.name || '';
    document.getElementById('c-edit-company').value = activeQuote.customer.company || '';
    document.getElementById('c-edit-email').value = activeQuote.customer.email || '';
    document.getElementById('c-edit-phone').value = activeQuote.customer.phone || '';
    document.getElementById('c-edit-address').value = activeQuote.customer.address || '';
    document.getElementById('c-edit-notes').value = activeQuote.customer.notes || '';

    // Set payment fields
    document.getElementById('q-payment-status').value = activeQuote.paymentStatus || 'New';
    document.getElementById('q-amount-paid').value = activeQuote.amountPaid || 0;
    document.getElementById('q-gst-inclusive').checked = activeQuote.gstInclusive || false;

    // Customer Insights (Repeat logic)
    const insightsDiv = document.getElementById('customer-insights');
    const pastQuotes = quotes.filter(q => q.id !== activeQuote.id && (q.customer.email === activeQuote.customer.email || q.customer.phone === activeQuote.customer.phone));

    if (pastQuotes.length > 0) {
        insightsDiv.style.display = 'block';
        insightsDiv.innerHTML = `🌟 <strong>Repeat Customer!</strong> They have made ${pastQuotes.length} previous enquiry request(s).`;
    } else {
        insightsDiv.style.display = 'block';
        insightsDiv.innerHTML = `👋 <strong>New Customer!</strong> This is their first enquiry.`;
    }

    document.getElementById('quote-items-container').innerHTML = activeQuote.items.map((item, idx) => {
        const prod = products.find(p => p.id === item.id);
        const stock = prod ? (prod.stockQty || 0) : 0;
        const costInfo = prod ? ` | <span style="color:#ef4444; font-weight:bold;">Cost: ₹${(prod.purchasePrice || 0).toLocaleString()}</span>` : '';
        const mrpInfo = prod ? ` | <span style="color:var(--primary); font-weight:bold;">MRP: ₹${(prod.price || 0).toLocaleString()}</span>` : '';

        // Stock Display
        const stockStatusColor = stock >= item.qty ? '#10b981' : (stock > 0 ? '#f59e0b' : '#ef4444');
        const stockLabel = stock >= item.qty ? 'READY' : (stock > 0 ? 'PARTIAL' : 'OUT');
        const stockInfo = ` | <span style="color:${stockStatusColor}; font-weight:800; background:rgba(255,255,255,0.03); padding:2px 6px; border-radius:4px; border:1px solid ${stockStatusColor}1a;">Stock: ${stock} (${stockLabel})</span>`;

        // Variant Display
        const variantInfo = item.variant ? `<br><span style="color:var(--primary); font-size:0.8rem; font-weight:700; text-transform:uppercase; background:rgba(41,121,255,0.1); padding:2px 8px; border-radius:4px; margin-top:4px; display:inline-block;">${item.variantName || 'Variant'}: ${item.variant}</span>` : '';

        return `
            <div style="background:rgba(255,255,255,0.03); border: 1px solid var(--border-color); padding: 15px; margin-bottom: 10px; border-radius:var(--radius-md); display:flex; gap:15px; align-items:center;">
                <div style="flex:1; color: var(--text-main);">
                    <strong style="font-size:1rem;">${item.name}</strong>${variantInfo}<br>
                    <small style="color:var(--text-muted);">Req: ${item.qty}${costInfo}${mrpInfo}${stockInfo}</small>
                </div>
                <div style="width:120px;">
                    <label style="font-size:0.75rem; font-weight:bold; color:var(--text-muted); text-transform:uppercase;">Unit Price</label>
                    <input type="number" id="q-price-${idx}" class="form-control" value="${item.price || 0}" required style="border-color: var(--primary);">
                </div>
                <div style="width:80px;">
                    <label style="font-size:0.75rem; font-weight:bold; color:var(--text-muted); text-transform:uppercase;">Final Qty</label>
                    <input type="number" id="q-qty-${idx}" class="form-control" value="${item.qty}" required>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('quote-modal').classList.add('active');
}

// ----------------------------------------
// PDF GENERATION & UPDATE
// ----------------------------------------
function getUpdatedQuoteData() {
    const updatedCustomer = {
        name: document.getElementById('c-edit-name').value,
        company: document.getElementById('c-edit-company').value,
        email: document.getElementById('c-edit-email').value,
        phone: document.getElementById('c-edit-phone').value,
        address: document.getElementById('c-edit-address').value,
        notes: document.getElementById('c-edit-notes').value,
    };

    const isInclusive = document.getElementById('q-gst-inclusive').checked;
    const taxRate = (appSettings.tax || 18) / 100;

    let subtotal = 0;
    const tableBody = [];
    const updatedItems = activeQuote.items.map((item, idx) => {
        const inputPrice = parseFloat(document.getElementById(`q-price-${idx}`).value) || 0;
        const finalQty = parseFloat(document.getElementById(`q-qty-${idx}`).value) || 1;

        // Math: Price = Base + (Base * TaxRate) => Base = Price / (1 + TaxRate)
        const unitPriceForPdf = isInclusive ? (inputPrice / (1 + taxRate)) : inputPrice;
        const lineSubtotal = unitPriceForPdf * finalQty;
        subtotal += lineSubtotal;

        const description = item.variant ? `${item.name}\n(${item.variantName || 'Variant'}: ${item.variant})` : item.name;
        tableBody.push([idx + 1, description, finalQty.toString(), `Rs. ${unitPriceForPdf.toFixed(2)}`, `Rs. ${lineSubtotal.toFixed(2)}`]);
        return { ...item, price: inputPrice, qty: finalQty };
    });

    const taxAmount = subtotal * taxRate;
    let grandTotal = subtotal + taxAmount;

    // For inclusive pricing, force rounding to the exact input sum to avoid 0.01 discrepancies
    if (isInclusive) {
        grandTotal = activeQuote.items.reduce((acc, _, i) => {
            const rowPrice = parseFloat(document.getElementById(`q-price-${i}`).value) || 0;
            const rowQty = parseFloat(document.getElementById(`q-qty-${i}`).value) || 0;
            return acc + (rowPrice * rowQty);
        }, 0);
    }

    const updatedPaymentStatus = document.getElementById('q-payment-status').value;
    const updatedAmountPaid = parseFloat(document.getElementById('q-amount-paid').value) || 0;
    const balancePending = grandTotal - updatedAmountPaid;

    return {
        updatedCustomer, updatedItems, updatedPaymentStatus, updatedAmountPaid,
        tableBody, subtotal, taxAmount, grandTotal, balancePending,
        gstInclusive: isInclusive,
        stockDeducted: activeQuote.stockDeducted || false
    };
}

async function saveQuoteUpdates(e) {
    if (e) e.preventDefault();
    if (!activeQuote) return;

    const btn = document.getElementById('update-quote-db-btn');
    btn.innerHTML = "Saving...";
    btn.disabled = true;

    try {
        const data = getUpdatedQuoteData();
        
        const updatePayload = {
            customer: data.updatedCustomer,
            items: data.updatedItems,
            paymentStatus: data.updatedPaymentStatus,
            amountPaid: data.updatedAmountPaid,
            gstInclusive: data.gstInclusive
        };

        // 🔄 AUTOMATIC STOCK DEDUCTION LOGIC
        if ((data.updatedPaymentStatus === 'Paid' || data.updatedPaymentStatus === 'Partial') && !data.stockDeducted) {
            if (confirm(`You are marking this as ${data.updatedPaymentStatus}. Should the system automatically deduct these items from your current Stock?`)) {
                for (const item of data.updatedItems) {
                    const pRef = doc(db, "products", item.id);
                    const pDoc = await getDoc(pRef);
                    if (pDoc.exists()) {
                        const currentStock = pDoc.data().stockQty || 0;
                        await updateDoc(pRef, { stockQty: Math.max(0, currentStock - item.qty) });
                    }
                }
                updatePayload.stockDeducted = true; // Mark as done to prevent double deduction
            }
        }

        await updateDoc(doc(db, "quotation_requests", activeQuote.id), updatePayload);
        await fetchQuotes();
        alert("Database successfully updated!");
    } catch (err) {
        alert("There was an error updating the database. Check console details.");
        console.error(err);
    } finally {
        btn.innerHTML = "<i class='bx bx-save'></i> Save Updates";
        btn.disabled = false;
    }
}

function downloadQuotePDF(e) {
    if (e) e.preventDefault();
    if (!activeQuote) return;

    const data = getUpdatedQuoteData();
    const jspdf = window.jspdf;
    const docDef = new jspdf.jsPDF();
    // Header
    const brandColor = [124, 58, 237]; // Primary Purple from settings

    if (appSettings.logo) {
        try {
            // PDF Logo placeholder - as adding image in jsPDF needs base64 
            // We'll stick to text branding for now if logo loading fails, but adding a block
            docDef.setFontSize(22); docDef.setTextColor(...brandColor);
            docDef.text("MB ENTERPRISES", 14, 20);
        } catch (e) {
            docDef.setFontSize(22); docDef.setTextColor(...brandColor);
            docDef.text("MB ENTERPRISES", 14, 20);
        }
    } else {
        docDef.setFontSize(22); docDef.setTextColor(...brandColor);
        docDef.text("MB ENTERPRISES", 14, 20);
    }

    docDef.setFontSize(10); docDef.setTextColor(80, 80, 80);
    docDef.text(appSettings.contact || "Email: vv414352@gmail.com | Phone: +91 96864 96501", 14, 28);
    docDef.text(appSettings.address || "Address: Rannerbenur, karnataka - 581112", 14, 33);

    // Quotation Info
    docDef.setFontSize(16); docDef.setTextColor(0, 0, 0);
    docDef.text("QUOTATION", 150, 20);
    docDef.setFontSize(10);
    docDef.text(`Date: ${new Date().toLocaleDateString()}`, 150, 28);
    docDef.text(`Quote #: QT-${Math.floor(1000 + Math.random() * 9000)}-${new Date().getFullYear()}`, 150, 33);

    docDef.line(14, 40, 196, 40);

    // Customer
    docDef.setFont("helvetica", "bold"); docDef.text("Bill To:", 14, 48);
    docDef.setFont("helvetica", "normal");
    const companyLabel = data.updatedCustomer.company ? `${data.updatedCustomer.company} (${data.updatedCustomer.name})` : data.updatedCustomer.name;
    docDef.text(companyLabel, 14, 53);
    docDef.text(data.updatedCustomer.phone, 14, 58);
    if (data.updatedCustomer.address) docDef.text(data.updatedCustomer.address, 14, 63);

    // Table
    docDef.autoTable({
        startY: 75,
        head: [['S.No', 'Description of Goods', 'Qty', 'Unit Price', 'Total']],
        body: data.tableBody,
        theme: 'grid',
        headStyles: { fillColor: brandColor, textColor: 255 },
        styles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 15 }, 2: { cellWidth: 20 }, 3: { cellWidth: 30 }, 4: { cellWidth: 35 } }
    });

    let finalY = docDef.lastAutoTable.finalY + 15;
    const pdfCurr = 'Rs.'; // Stable currency for PDF
    docDef.setFont("helvetica", "bold");
    docDef.setFontSize(10);
    docDef.text("Subtotal:", 135, finalY);
    docDef.text(`${pdfCurr} ${data.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 196, finalY, { align: 'right' });

    docDef.text(`Estimated GST (${appSettings.tax}%):`, 135, finalY + 8);
    docDef.text(`${pdfCurr} ${data.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 196, finalY + 8, { align: 'right' });

    finalY += 18;
    docDef.setFontSize(12);
    docDef.text("GRAND TOTAL:", 135, finalY);
    docDef.setTextColor(...brandColor);
    docDef.text(`${pdfCurr} ${data.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 196, finalY, { align: 'right' });

    // Payment Block
    if (data.updatedAmountPaid > 0) {
        finalY += 12;
        docDef.setFontSize(10);
        docDef.setTextColor(0, 0, 0);
        docDef.text("Amount Received:", 135, finalY);
        docDef.text(`${pdfCurr} ${data.updatedAmountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 196, finalY, { align: 'right' });

        finalY += 8;
        docDef.setTextColor(220, 53, 69); // Red for pending
        if (data.balancePending <= 0) docDef.setTextColor(40, 167, 69); // Green if clear
        docDef.text("BALANCE DUE:", 135, finalY);
        docDef.text(`${pdfCurr} ${Math.max(0, data.balancePending).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 196, finalY, { align: 'right' });
    }

    // Terms
    docDef.setFontSize(9); docDef.setTextColor(0, 0, 0);
    docDef.text("Terms & Conditions:", 14, finalY + 30);
    docDef.setFont("helvetica", "normal");
    docDef.text("1. Advanced payment of 50% required upon order confirmation.", 14, finalY + 35);
    docDef.text("2. Delivery within 7-10 business days of initial deposit.", 14, finalY + 40);

    docDef.save(`Quotation_${data.updatedCustomer.company || data.updatedCustomer.name}_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
}

// Global Settings Logic
async function fetchSettings() {
    try {
        const sDoc = await getDoc(doc(db, "settings", "general"));
        if (sDoc.exists()) {
            appSettings = { ...appSettings, ...sDoc.data() };
            document.getElementById('s-logo').value = appSettings.logo || '';
            document.getElementById('s-address').value = appSettings.address || '';
            document.getElementById('s-contact').value = appSettings.contact || '';
            document.getElementById('s-tax').value = appSettings.tax || 18;
            document.getElementById('s-currency').value = appSettings.currency || '₹';
        }
    } catch (e) { console.error("Error fetching settings:", e); }
}

document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerText = "Saving...";

    appSettings = {
        logo: document.getElementById('s-logo').value,
        address: document.getElementById('s-address').value,
        contact: document.getElementById('s-contact').value,
        tax: Number(document.getElementById('s-tax').value),
        currency: document.getElementById('s-currency').value
    };

    try {
        await setDoc(doc(db, "settings", "general"), appSettings);
        alert("Settings saved successfully!");
        updateDashboardStats();
    } catch (e) { alert("Failed to save settings."); }
    finally { btn.innerText = "Save All Settings"; }
});

// Initialization update
const originalInit = window.onload;
window.onload = async () => {
    // Basic logic moved into the login flow check in admin.js
}

// Ensure settings loaded during dashboard fetch
// (This would be better in a central init, but appending logic)
// ----------------------------------------
// STOCK LIST LOGIC
// ----------------------------------------
function renderStockList() {
    const availableBody = document.getElementById('admin-available-stock-body');
    const procurementList = document.getElementById('procurement-list-tabbed-container');

    // 1. Render "Stocks I Have" (In Hand)
    // Filter out items with 0 stock
    const availableProducts = products.filter(p => (p.stockQty || 0) > 0);

    if (availableBody) {
        availableBody.innerHTML = availableProducts.map(p => {
            const qty = p.stockQty || 0;
            const status = qty > 5 ? '<span style="color:#10b981; background:rgba(16,185,129,0.1); padding:4px 10px; border-radius:12px; font-size:0.75rem;">Healthy</span>' :
                '<span style="color:#f59e0b; background:rgba(245,158,11,0.1); padding:4px 10px; border-radius:12px; font-size:0.75rem;">Low Stock</span>';
            return `
                <tr>
                    <td><strong>${p.name}</strong></td>
                    <td><span style="color:var(--text-muted);">${p.category}</span></td>
                    <td><span style="font-weight:600; color:var(--primary); font-size:1.1rem;">${qty}</span> <small>Units</small></td>
                    <td>₹${(p.purchasePrice || 0).toLocaleString()}</td>
                    <td>${status}</td>
                </tr>
            `;
        }).join('');

        if (availableProducts.length === 0) {
            availableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);">No stock currently in hand.</td></tr>';
        }
    }

    // 2. Calculate Procurement (Required vs Available)
    const activeStatus = ['New', 'Quote Sent', 'Partial', 'Hold'];
    const requirements = {};

    quotes.forEach(q => {
        const s = q.paymentStatus || 'New';
        if (activeStatus.includes(s)) {
            q.items.forEach(item => {
                const key = item.id + (item.variant || '');
                if (!requirements[key]) {
                    requirements[key] = {
                        id: item.id,
                        name: item.name,
                        variant: item.variant,
                        requestedQty: 0
                    };
                }
                requirements[key].requestedQty += (item.qty || 1);
            });
        }
    });

    const procurementItems = Object.keys(requirements).map(key => {
        const req = requirements[key];
        const prod = products.find(p => p.id === req.id);
        const available = prod ? (prod.stockQty || 0) : 0;
        const toBring = Math.max(0, req.requestedQty - available);

        if (toBring === 0) return null; // Already sufficient stock

        const variantTag = req.variant ? ` <small style="color:var(--primary); font-weight:700;">(${req.variant})</small>` : '';

        return `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; animation: pageIn 0.3s ease;">
                <div style="display:flex; align-items:center; gap:15px;">
                    <div style="width:40px; height:40px; border-radius:8px; background:rgba(239, 68, 68, 0.1); color:#ef4444; display:flex; align-items:center; justify-content:center; font-size:1.2rem;">
                        <i class='bx bx-alarm-exclamation'></i>
                    </div>
                    <div>
                        <strong style="display: block; font-size: 1rem; color:var(--text-main);">${req.name}${variantTag}</strong>
                        <div style="display: flex; gap: 15px; margin-top: 5px;">
                            <span style="font-size: 0.8rem; color: var(--text-muted);">Total Required: <b style="color:var(--text-main);">${req.requestedQty}</b></span>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">Currently in Hand: <b style="color:#3b82f6;">${available}</b></span>
                        </div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="color: var(--text-muted); font-size: 0.75rem; margin-bottom:4px; text-transform:uppercase; letter-spacing:1px;">Need to Purchase</div>
                    <div style="background: #ef4444; color: #fff; padding: 6px 16px; border-radius: 8px; font-weight: 800; font-size: 1.1rem; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);">
                        ${toBring} <small style="font-size:0.7rem;">UNITS</small>
                    </div>
                </div>
            </div>
        `;
    }).filter(x => x !== null).join('');

    if (procurementList) {
        procurementList.innerHTML = procurementItems || `
            <div style="text-align:center; padding: 40px; color:var(--text-muted); background:rgba(16,185,129,0.03); border:1px dashed rgba(16,185,129,0.2); border-radius:12px;">
                <i class='bx bx-check-circle' style="font-size:2.5rem; color:#10b981; margin-bottom:10px; display:block;"></i>
                <p>All client orders are covered! No procurement needed.</p>
            </div>
        `;
    }
}

// Data initialization is handled by initAdmin() and onSnapshot listeners

