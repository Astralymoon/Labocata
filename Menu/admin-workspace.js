
window.slugify = text => text.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');
/**
 * Admin Workspace Logic for Labocata
 */

let allProducts = [];
let allCategories = [];
let systemTags = [
    { id: "v", label: "Vegetariano" },
    { id: "vg", label: "Vegano" },
    { id: "gf", label: "Sin gluten" },
    { id: "s", label: "Signature" },
    { id: "nuevo", label: "Nuevo" }
];
let orderedCategoryIds = [];
let weeklyCombos = {}; // Day (0-6) -> { title, subtitle, dish1, dish2, price }

document.addEventListener("DOMContentLoaded", async () => {
    await window.auth.requireAdmin();
    const user = await window.auth.getUser();
    if (user) document.getElementById('user-email').textContent = user.email;

    await refreshData();
    setupEventListeners();

    // Initial preview load
    setTimeout(initPreview, 1000);
});

async function refreshData() {
    const [prods, cats] = await Promise.all([
        window.supabaseClient.from('products').select('*'),
        window.supabaseClient.from('categories').select('*').order('created_at', { ascending: true })
    ]);

    allProducts = prods.data || [];
    let fetchedCategories = cats.data || [];

    // Load dynamic config from a special product record if exists
    const tagsRecord = allProducts.find(p => p.name === '___SYSTEM_TAGS___');
    if (tagsRecord) {
        try {
            let configText = tagsRecord.description;
            if (configText && (configText.startsWith('{') || configText.startsWith('['))) {
                const config = JSON.parse(configText);
                if (Array.isArray(config)) {
                    systemTags = config;
                } else {
                    systemTags = config.tags || systemTags;
                    orderedCategoryIds = config.orderedCategoryIds || [];
                    weeklyCombos = config.weeklyCombos || {};
                }
            }
        } catch (e) { console.error("Error parsing system config", e); }
    }

    // Sort categories based on stored order
    if (orderedCategoryIds.length > 0) {
        fetchedCategories.sort((a, b) => {
            const indexA = orderedCategoryIds.indexOf(a.id);
            const indexB = orderedCategoryIds.indexOf(b.id);
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
    }
    allCategories = fetchedCategories;

    renderCatalog();
    renderCategorySelect();
    renderCategoryManager();
    renderTagCloud();
    renderTagManager();
}

// UI TABS
window.switchPaneTab = (tab) => {
    document.querySelectorAll('.pane-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.pane-content').forEach(el => el.style.display = 'none');

    document.getElementById(`tab-btn-${tab}`).classList.add('active');
    document.getElementById(`tab-${tab}`).style.display = 'block';
};

// CATALOG RENDERING
function renderCatalog() {
    const list = document.getElementById('admin-catalog-list');
    list.innerHTML = "";

    allCategories.forEach(cat => {
        const group = document.createElement('div');
        group.className = 'cat-group';

        const catHeader = document.createElement('div');
        catHeader.className = 'cat-item';
        catHeader.innerHTML = `<span>${cat.name}</span> <small style="color:#888">${allProducts.filter(p => p.category_id === cat.id && p.name !== '___SYSTEM_TAGS___').length}</small>`;
        group.appendChild(catHeader);

        allProducts.filter(p => p.category_id === cat.id && p.name !== '___SYSTEM_TAGS___').forEach(prod => {
            const pItem = document.createElement('div');
            pItem.className = 'product-item';
            if (prod.id === document.getElementById('dishId').value) pItem.classList.add('active');
            pItem.innerHTML = `
                ${prod.name}
                ${prod.featured ? '<span class="status-badge featured">★</span>' : ''}
            `;
            pItem.onclick = () => loadProduct(prod.id);
            group.appendChild(pItem);
        });

        list.appendChild(group);
    });
}

function renderCategorySelect() {
    const select = document.getElementById('category');
    select.innerHTML = allCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

// CATEGORY MANAGER
function renderCategoryManager() {
    const list = document.getElementById('category-manager-list');
    list.innerHTML = allCategories.map((cat, index) => `
        <div class="cat-manager-item">
            <span>${cat.name}</span>
            <div style="display:flex; gap:0.25rem;">
                <button class="btn btn-ghost" style="padding:0.2rem 0.5rem" onclick="moveCategory(${index}, -1)" ${index === 0 ? 'disabled' : ''}>↑</button>
                <button class="btn btn-ghost" style="padding:0.2rem 0.5rem" onclick="moveCategory(${index}, 1)" ${index === allCategories.length - 1 ? 'disabled' : ''}>↓</button>
                <button class="btn btn-ghost" style="padding:0.2rem 0.5rem" onclick="openCategoryModal('${cat.id}', '${cat.name}')">✎</button>
                <button class="btn btn-danger" style="padding:0.2rem 0.5rem" onclick="deleteCategory('${cat.id}', '${cat.name}')">×</button>
            </div>
        </div>
    `).join('');
}

window.moveCategory = async (index, direction) => {
    const newCategories = [...allCategories];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newCategories.length) return;

    const [moved] = newCategories.splice(index, 1);
    newCategories.splice(targetIndex, 0, moved);

    orderedCategoryIds = newCategories.map(c => c.id);
    await persistConfig();
    await refreshData();
};

window.openCategoryModal = (id = "", name = "") => {
    document.getElementById('cat-modal-title').textContent = id ? "Editar Categoría" : "Nueva Categoría";
    document.getElementById('new-cat-name').value = name;
    document.getElementById('category-modal').dataset.editId = id;
    document.getElementById('category-modal').classList.add('active');
};

window.saveCategory = async () => {
    const name = document.getElementById('new-cat-name').value.trim();
    const id = document.getElementById('category-modal').dataset.editId;
    if (!name) return;

    let res;
    if (id) {
        res = await window.supabaseClient.from('categories').update({ name, slug: window.slugify(name) }).eq('id', id);
    } else {
        res = await window.supabaseClient.from('categories').insert([{ name, slug: window.slugify(name) }]);
    }

    if (res.error) alert("Error: " + res.error.message);
    else {
        closeModals();
        await refreshData();
    }
};

window.deleteCategory = async (id, name) => {
    const hasProducts = allProducts.some(p => p.category_id === id);
    if (hasProducts) {
        alert("No puedes borrar una categoría con platillos.");
        return;
    }
    if (confirm(`¿Borrar categoría "${name}"?`)) {
        await window.supabaseClient.from('categories').delete().eq('id', id);
        await refreshData();
    }
};

// TAGS
function renderTagCloud() {
    const container = document.getElementById('tag-cloud');
    container.innerHTML = systemTags.map(tag => `
        <label style="cursor:pointer; display:flex; align-items:center; gap:0.3rem; padding:0.3rem 0.6rem; background:#eee; border-radius:15px; font-size:0.75rem;">
            <input type="checkbox" name="tags" value="${tag.id}" onchange="updatePreview()">
            ${tag.label}
        </label>
    `).join('');
}

function renderTagManager() {
    const list = document.getElementById('tag-manager-list');
    list.innerHTML = systemTags.map(tag => `
        <div class="tag-manager-item">
            <span><strong>${tag.id}</strong>: ${tag.label}</span>
            <button class="btn btn-danger" style="padding:0.2rem 0.5rem" onclick="deleteTag('${tag.id}')">×</button>
        </div>
    `).join('');
}

window.openTagModal = () => document.getElementById('tag-modal').classList.add('active');

async function persistConfig() {
    const tagsRecord = allProducts.find(p => p.name === '___SYSTEM_TAGS___');
    const config = {
        tags: systemTags,
        orderedCategoryIds: orderedCategoryIds,
        weeklyCombos: weeklyCombos
    };
    const payload = {
        name: '___SYSTEM_TAGS___',
        description: JSON.stringify(config),
        price: 0,
        category_id: allCategories[0]?.id
    };
    if (tagsRecord) {
        await window.supabaseClient.from('products').update(payload).eq('id', tagsRecord.id);
    } else if (allCategories.length > 0) {
        await window.supabaseClient.from('products').insert([payload]);
    }
}

window.saveTag = async () => {
    const id = document.getElementById('new-tag-id').value.trim().toLowerCase();
    const label = document.getElementById('new-tag-label').value.trim();
    if (!id || !label) return;
    if (systemTags.some(t => t.id === id)) {
        alert("ID de etiqueta ya existe.");
        return;
    }
    systemTags.push({ id, label });
    await persistConfig();
    closeModals();
    renderTagCloud();
    renderTagManager();
};

window.deleteTag = async (id) => {
    systemTags = systemTags.filter(t => t.id !== id);
    await persistConfig();
    renderTagCloud();
    renderTagManager();
};

// COMBOS
window.openComboModal = () => {
    const d1 = document.getElementById('combo-dish1');
    const d2 = document.getElementById('combo-dish2');
    const options = allProducts
        .filter(p => p.name !== '___SYSTEM_TAGS___')
        .map(p => `<option value="${p.id}">${p.name}</option>`)
        .join('');
    d1.innerHTML = `<option value="">-- Seleccionar --</option>` + options;
    d2.innerHTML = `<option value="">-- Seleccionar --</option>` + options;

    document.getElementById('combo-day').value = new Date().getDay();
    loadComboDay(new Date().getDay());
    document.getElementById('combo-modal').classList.add('active');
};

window.loadComboDay = (day) => {
    const combo = weeklyCombos[day] || { title: "", subtitle: "", dish1: "", dish2: "", price: "" };
    document.getElementById('combo-title').value = combo.title;
    document.getElementById('combo-subtitle').value = combo.subtitle;
    document.getElementById('combo-dish1').value = combo.dish1;
    document.getElementById('combo-dish2').value = combo.dish2;
    document.getElementById('combo-price').value = combo.price;
};

window.saveComboDay = async () => {
    const day = document.getElementById('combo-day').value;
    weeklyCombos[day] = {
        title: document.getElementById('combo-title').value,
        subtitle: document.getElementById('combo-subtitle').value,
        dish1: document.getElementById('combo-dish1').value,
        dish2: document.getElementById('combo-dish2').value,
        price: document.getElementById('combo-price').value
    };
    await persistConfig();
    alert("Día guardado correctamente.");
};

window.closeModals = () => {
    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active'));
};

// PRODUCT EDITOR
window.toggleDrinkFields = () => {
    const catSelect = document.getElementById('category');
    const catName = catSelect.options[catSelect.selectedIndex]?.text.toLowerCase() || "";
    document.getElementById('drink-type-field').style.display = catName.includes('bebida') ? 'block' : 'none';
};

function loadProduct(id) {
    const prod = allProducts.find(p => p.id === id);
    if (!prod) return;

    document.getElementById('editor-title').textContent = "Editando: " + prod.name;
    document.getElementById('delete-product-btn').style.display = "block";
    document.getElementById('dishId').value = prod.id;
    document.getElementById('name').value = prod.name;
    document.getElementById('price').value = prod.price;
    document.getElementById('category').value = prod.category_id;
    document.getElementById('image').value = prod.image_url || "";
    document.getElementById('featured').checked = prod.featured;
    document.getElementById('special-price-field').style.display = prod.featured ? 'block' : 'none';

    toggleDrinkFields();

    // Description & Variants
    try {
        if (prod.description.startsWith('{')) {
            const data = JSON.parse(prod.description);
            document.getElementById('description').value = data.main_description || "";
            document.getElementById('special_price').value = data.special_price || "";
            document.getElementById('visual_style').value = data.visual_style || "auto";
            renderVariants(data.variants || []);
            if (data.tipo_bebida) {
                document.getElementById('drink-type').value = data.tipo_bebida;
            }
        } else {
            document.getElementById('description').value = prod.description;
            document.getElementById('visual_style').value = "auto";
            renderVariants([]);
        }
    } catch (e) {
        document.getElementById('description').value = prod.description;
        renderVariants([]);
    }

    // Tags
    const tagChecks = document.querySelectorAll('input[name="tags"]');
    let prodTags = [];
    try {
        if (prod.description.startsWith('{')) {
            const data = JSON.parse(prod.description);
            prodTags = data.tags || [];
        }
    } catch (e) {}

    tagChecks.forEach(cb => {
        cb.checked = prodTags.includes(cb.value);
    });

    renderCatalog(); // Refresh active state
    updatePreview();
}

function renderVariants(variants) {
    const list = document.getElementById('variants-list');
    list.innerHTML = "";
    variants.forEach(v => addVariantRow(v));
}

window.addVariantRow = (data = { name: "", price: "" }) => {
    const list = document.getElementById('variants-list');
    const row = document.createElement('div');
    row.className = 'variant-row';
    row.innerHTML = `
        <input type="text" placeholder="Opción (ej: Extra Jamón)" value="${data.name}" oninput="updatePreview()">
        <input type="number" step="0.01" placeholder="Precio" value="${data.price}" oninput="updatePreview()">
        <button type="button" class="btn btn-danger" style="padding:0.2rem 0.5rem; width:32px;" onclick="this.parentElement.remove(); updatePreview();">×</button>
    `;
    list.appendChild(row);
};

function resetEditor() {
    document.getElementById('editor-title').textContent = "Nuevo Platillo";
    document.getElementById('delete-product-btn').style.display = "none";
    document.getElementById('product-form').reset();
    document.getElementById('dishId').value = "";
    document.getElementById('variants-list').innerHTML = "";
    document.getElementById('visual_style').value = "auto";
    toggleDrinkFields();
    renderCatalog();
    updatePreview();
}

async function deleteProduct() {
    const id = document.getElementById('dishId').value;
    const name = document.getElementById('name').value;
    if (!id) return;

    if (confirm(`¿Estás seguro de que quieres borrar "${name}"?`)) {
        const res = await window.supabaseClient.from('products').delete().eq('id', id);
        if (res.error) {
            alert("Error al borrar: " + res.error.message);
        } else {
            resetEditor();
            await refreshData();
        }
    }
}

async function saveProduct() {
    const id = document.getElementById('dishId').value;
    const name = document.getElementById('name').value;
    const price = Number(document.getElementById('price').value);
    const category_id = document.getElementById('category').value;
    const description_text = document.getElementById('description').value;
    const image_url = document.getElementById('image').value;
    const featured = document.getElementById('featured').checked;
    const special_price = Number(document.getElementById('special_price').value);
    const drink_type = document.getElementById('drink-type').value;
    const visual_style = document.getElementById('visual_style').value;

    const catSelect = document.getElementById('category');
    const catName = catSelect.options[catSelect.selectedIndex]?.text.toLowerCase() || "";
    const isDrink = catName.includes('bebida');

    // Collect tags
    const tags = Array.from(document.querySelectorAll('input[name="tags"]:checked')).map(cb => cb.value);

    // Collect variants
    const variantRows = document.querySelectorAll('.variant-row');
    const variants = Array.from(variantRows).map(row => {
        const inputs = row.querySelectorAll('input');
        return { name: inputs[0].value, price: Number(inputs[1].value) };
    }).filter(v => v.name && v.price);

    // Prepare description (JSON)
    const descObj = {
        main_description: description_text,
        variants: variants,
        special_price: special_price || null,
        tags: tags,
        visual_style: visual_style
    };
    if (isDrink) descObj.tipo_bebida = drink_type;

    const description = JSON.stringify(descObj);

    const payload = { name, price, category_id, description, image_url, featured };

    let res;
    if (id) {
        res = await window.supabaseClient.from('products').update(payload).eq('id', id);
    } else {
        res = await window.supabaseClient.from('products').insert([payload]);
    }

    if (res.error) {
        alert("Error al guardar: " + res.error.message);
    } else {
        await refreshData();
        if (!id) resetEditor();
        else loadProduct(id);
    }
}

function setupEventListeners() {
    document.getElementById('save-product-btn').onclick = saveProduct;

    // Auto-update preview on input
    const inputs = document.querySelectorAll('#product-form input, #product-form select, #product-form textarea');
    inputs.forEach(input => {
        input.addEventListener('input', updatePreview);
    });
}

// PREVIEW LOGIC
function initPreview() {
    const mount = document.getElementById('live-preview-mount');
    mount.innerHTML = `<iframe id="preview-iframe" src="MenuV3.html" style="width:100%; height:100%; border:none;"></iframe>`;
}

function updatePreview() {
    const iframe = document.getElementById('preview-iframe');
    if (!iframe || !iframe.contentWindow) return;

    const name = document.getElementById('name').value || "Nombre del Platillo";
    const price = Number(document.getElementById('price').value) || 0;
    const description_text = document.getElementById('description').value || "Descripción breve...";
    const image_url = document.getElementById('image').value || "";
    const featured = document.getElementById('featured').checked;
    const special_price = Number(document.getElementById('special_price').value);
    const tags = Array.from(document.querySelectorAll('input[name="tags"]:checked')).map(cb => cb.value);
    const drink_type = document.getElementById('drink-type').value;
    const visual_style = document.getElementById('visual_style').value;

    const variantRows = document.querySelectorAll('.variant-row');
    const variants = Array.from(variantRows).map(row => {
        const inputs = row.querySelectorAll('input');
        return { name: inputs[0].value, price: Number(inputs[1].value) };
    }).filter(v => v.name && v.price);

    const catSelect = document.getElementById('category');
    const catName = catSelect.options[catSelect.selectedIndex]?.text.toLowerCase() || "";
    const isDrink = catName.includes('bebida');

    const descObj = {
        main_description: description_text,
        variants,
        special_price: special_price || null,
        tags: tags,
        visual_style: visual_style
    };
    if (isDrink) descObj.tipo_bebida = drink_type;

    const virtualProduct = {
        id: 'preview-id',
        name,
        price,
        description: JSON.stringify(descObj),
        image_url,
        featured,
        category_id: document.getElementById('category').value
    };

    iframe.contentWindow.postMessage({ type: 'PREVIEW_UPDATE', product: virtualProduct }, '*');
}

window.refreshPreview = () => {
    initPreview();
    setTimeout(updatePreview, 1000);
};

window.updatePreviewMode = (val) => {
    const frame = document.querySelector('.preview-frame');
    if (val === 'mobile') {
        frame.classList.remove('desktop-mode');
        // Reset inline styles if any were set by the old function
        frame.style.width = '';
        frame.style.minHeight = '';
        frame.style.borderRadius = '';
        frame.style.border = '';
    } else {
        frame.classList.add('desktop-mode');
        frame.style.width = '';
        frame.style.minHeight = '';
        frame.style.borderRadius = '';
        frame.style.border = '';
    }
};

window.resetEditor = resetEditor;
