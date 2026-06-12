/**
 * Admin Panel Specialized Logic
 * Handles real-time preview, variants, tags, and categories.
 */

document.addEventListener("DOMContentLoaded", async () => {
    const adminForm = document.getElementById("adminDishForm");
    const variantsContainer = document.getElementById("variantsContainer");
    const btnAddVariant = document.getElementById("btnAddVariant");
    const tagSelector = document.getElementById("tagSelector");
    const productList = document.getElementById("productList");
    const productFormPane = document.getElementById("productForm");
    const viewTitle = document.getElementById("viewTitle");
    const btnAddNew = document.getElementById("btnAddNew");
    const btnBackToList = document.getElementById("btnBackToList");
    const sidebarItems = document.querySelectorAll(".nav-item");
    const viewPanes = document.querySelectorAll(".view-pane");

    let currentVariants = [];
    let selectedTags = [];
    let allTags = [];
    let allCategories = [];

    // --- VIEW SWITCHING ---
    const showView = (viewId) => {
        viewPanes.forEach(p => p.style.display = 'none');
        const activePane = document.getElementById(viewId + (viewId.includes('List') || viewId.includes('Form') ? '' : 'List'));
        if (activePane) activePane.style.display = 'block';

        sidebarItems.forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewId);
        });

        const titles = {
            'products': 'Gestión de Platillos',
            'categories': 'Categorías y Divisores',
            'tags': 'Etiquetas Personalizadas',
            'special': 'Platillo del Día'
        };
        viewTitle.textContent = titles[viewId] || 'Admin Panel';

        if (viewId === 'products') {
            btnAddNew.style.display = 'block';
            refreshProductList();
        } else if (viewId === 'categories') {
            btnAddNew.style.display = 'none';
            refreshCategoryList();
        } else if (viewId === 'tags') {
            btnAddNew.style.display = 'none';
            refreshTagList();
        }
    };

    sidebarItems.forEach(item => {
        item.addEventListener('click', () => showView(item.dataset.view));
    });

    btnAddNew.addEventListener('click', () => {
        resetForm();
        productList.style.display = 'none';
        productFormPane.style.display = 'block';
        btnAddNew.style.display = 'none';
    });

    btnBackToList.addEventListener('click', () => {
        productFormPane.style.display = 'none';
        productList.style.display = 'block';
        btnAddNew.style.display = 'block';
    });

    // --- DATA FETCHING ---
    const fetchMetadata = async () => {
        // Fetch Categories
        const { data: cats } = await window.supabaseClient.from('categories').select('*').order('order_index');
        allCategories = cats || [];
        const catSelect = document.getElementById("category");
        catSelect.innerHTML = allCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

        // Fetch Tags
        const { data: tags } = await window.supabaseClient.from('tags').select('*');
        allTags = tags || [];
        renderTagSelector();
    };

    const renderTagSelector = () => {
        tagSelector.innerHTML = allTags.map(t => `
            <div class="tag-chip ${selectedTags.includes(t.name) ? 'active' : ''}" onclick="toggleTag('${t.name}')">
                ${t.name}
            </div>
        `).join('');
    };

    window.toggleTag = (tagName) => {
        const index = selectedTags.indexOf(tagName);
        if (index > -1) selectedTags.splice(index, 1);
        else selectedTags.push(tagName);
        renderTagSelector();
        updatePreview();
    };

    // --- VARIANTS ---
    btnAddVariant.addEventListener('click', () => {
        addVariantRow('', '');
    });

    const addVariantRow = (label, price) => {
        const row = document.createElement('div');
        row.className = 'variant-row';
        row.innerHTML = `
            <input type="text" placeholder="Tamaño/Etiqueta" value="${label}" onchange="updatePreview()">
            <input type="number" placeholder="Precio" value="${price}" step="0.01" onchange="updatePreview()">
            <span class="btn-remove" onclick="this.parentElement.remove(); updatePreview();">×</span>
        `;
        variantsContainer.appendChild(row);
    };

    const getVariants = () => {
        return Array.from(variantsContainer.querySelectorAll('.variant-row')).map(row => ({
            label: row.querySelectorAll('input')[0].value,
            price: parseFloat(row.querySelectorAll('input')[1].value)
        })).filter(v => v.label && !isNaN(v.price));
    };

    // --- PRODUCT LIST ---
    const refreshProductList = async () => {
        const { data: products } = await window.supabaseClient.from('products').select('*').order('created_at', { ascending: false });
        productList.innerHTML = products.map(p => `
            <div class="item-list-entry" onclick="editProduct('${p.id}')">
                <div>
                    <strong>${p.name}</strong><br>
                    <small style="color:var(--warm-grey)">${p.category_id}</small>
                </div>
                <div>$${p.price || 'Varias'}</div>
            </div>
        `).join('');
    };

    window.editProduct = async (id) => {
        const { data: p } = await window.supabaseClient.from('products').select('*').eq('id', id).single();
        if (!p) return;

        resetForm();
        document.getElementById("dishId").value = p.id;
        document.getElementById("name").value = p.name;
        document.getElementById("description").value = p.description;
        document.getElementById("category").value = p.category_id;
        document.getElementById("price").value = p.price || '';
        document.getElementById("image_url").value = p.image_url || '';
        document.getElementById("featured").checked = p.featured;
        document.getElementById("is_today_special").checked = p.is_today_special || false;

        selectedTags = p.tags || [];
        renderTagSelector();

        if (p.variants) {
            p.variants.forEach(v => addVariantRow(v.label, v.price));
        }

        productList.style.display = 'none';
        productFormPane.style.display = 'block';
        btnAddNew.style.display = 'none';
        updatePreview();
    };

    const resetForm = () => {
        adminForm.reset();
        document.getElementById("dishId").value = '';
        variantsContainer.innerHTML = '';
        selectedTags = [];
        renderTagSelector();
        updatePreview();
    };

    // --- FORM SUBMISSION ---
    adminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById("dishId").value;
        const payload = {
            name: document.getElementById("name").value,
            description: document.getElementById("description").value,
            category_id: document.getElementById("category").value,
            price: parseFloat(document.getElementById("price").value) || null,
            image_url: document.getElementById("image_url").value,
            tags: selectedTags,
            variants: getVariants(),
            featured: document.getElementById("featured").checked,
            is_today_special: document.getElementById("is_today_special").checked
        };

        let res;
        if (id) {
            res = await window.supabaseClient.from('products').update(payload).eq('id', id);
        } else {
            res = await window.supabaseClient.from('products').insert([payload]);
        }

        if (res.error) {
            alert("Error al guardar: " + res.error.message);
        } else {
            alert("Platillo guardado correctamente.");
            btnBackToList.click();
        }
    });

    // --- PREVIEW SYSTEM ---
    const updatePreview = () => {
        const previewBody = document.getElementById("previewMenuBody");
        const currentData = {
            name: document.getElementById("name").value || "Nombre del Platillo",
            description: document.getElementById("description").value || "Descripción del platillo...",
            price: document.getElementById("price").value,
            image_url: document.getElementById("image_url").value || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80",
            tags: selectedTags,
            variants: getVariants(),
            featured: document.getElementById("featured").checked
        };

        // Replicate a simplified version of the menu card
        const tagsHtml = currentData.tags.map(t => `<span class="item-tag custom">${t}</span>`).join('');
        const variantsHtml = currentData.variants.map(v => `<div style="font-size:0.8rem; color:var(--bronze)">${v.label}: $${v.price}</div>`).join('');

        let cardClass = "menu-item " + (currentData.featured ? "featured" : "has-photo");

        previewBody.innerHTML = `
            <div class="cat-header">
                <div>
                    <span class="cat-num">PREVIEW</span>
                    <h2 class="cat-title">Vista <em>Previa</em></h2>
                </div>
            </div>
            <div class="menu-grid" style="grid-template-columns: 1fr;">
                <div class="${cardClass}">
                    <div class="item-photo">
                        <img src="${currentData.image_url}" alt="Preview">
                    </div>
                    <div class="item-body">
                        ${currentData.featured ? '<span class="featured-badge">✦ &nbsp;Destacado</span>' : ''}
                        <div class="item-header">
                            <h3 class="item-name">${currentData.name}</h3>
                            <span class="item-price">${currentData.price ? '$' + currentData.price : 'Varias'}</span>
                        </div>
                        <p class="item-desc">${currentData.description}</p>
                        ${variantsHtml ? `<div style="margin-bottom:10px;">${variantsHtml}</div>` : ''}
                        <div class="item-footer">
                            <div class="item-tags">${tagsHtml}</div>
                            <button class="add-btn">Agregar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    // Listener for real-time changes
    adminForm.addEventListener('input', updatePreview);

    // Initial Load
    await fetchMetadata();
    showView('products');
});
