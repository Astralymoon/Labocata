/**
 * Admin Workspace Logic for Labocata
 */

let allProducts = [];
let allCategories = [];
const systemTags = [
    { id: "v", label: "Vegetariano" },
    { id: "vg", label: "Vegano" },
    { id: "gf", label: "Sin gluten" },
    { id: "s", label: "Signature" },
    { id: "nuevo", label: "Nuevo" }
];

document.addEventListener("DOMContentLoaded", async () => {
    await window.auth.requireAdmin();
    const user = await window.auth.getUser();
    if (user) document.getElementById('user-email').textContent = user.email;

    await refreshData();
    setupEventListeners();
    renderTags();

    // Initial preview load
    setTimeout(initPreview, 1000);
});

async function refreshData() {
    const [prods, cats] = await Promise.all([
        window.supabaseClient.from('products').select('*'),
        window.supabaseClient.from('categories').select('*').order('created_at', { ascending: true })
    ]);

    allProducts = prods.data || [];
    allCategories = cats.data || [];

    renderCatalog();
    renderCategorySelect();
}

function renderCatalog() {
    const list = document.getElementById('admin-catalog-list');
    list.innerHTML = "";

    allCategories.forEach(cat => {
        const group = document.createElement('div');
        group.className = 'cat-group';

        const catHeader = document.createElement('div');
        catHeader.className = 'cat-item';
        catHeader.innerHTML = `<span>${cat.name}</span> <small style="color:#888">${allProducts.filter(p => p.category_id === cat.id).length}</small>`;
        group.appendChild(catHeader);

        allProducts.filter(p => p.category_id === cat.id).forEach(prod => {
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

function renderTags() {
    const container = document.getElementById('tag-cloud');
    container.innerHTML = systemTags.map(tag => `
        <label style="cursor:pointer; display:flex; align-items:center; gap:0.3rem; padding:0.3rem 0.6rem; background:#eee; border-radius:15px; font-size:0.75rem;">
            <input type="checkbox" name="tags" value="${tag.id}" onchange="updatePreview()">
            ${tag.label}
        </label>
    `).join('');
}

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

    // Description & Variants
    try {
        if (prod.description.startsWith('{')) {
            const data = JSON.parse(prod.description);
            document.getElementById('description').value = data.main_description || "";
            renderVariants(data.variants || []);
        } else {
            document.getElementById('description').value = prod.description;
            renderVariants([]);
        }
    } catch (e) {
        document.getElementById('description').value = prod.description;
        renderVariants([]);
    }

    // Tags
    const tagChecks = document.querySelectorAll('input[name="tags"]');
    tagChecks.forEach(cb => {
        cb.checked = (prod.tags || []).includes(cb.value);
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
        <input type="text" placeholder="Nombre (ej: Grande)" value="${data.name}" oninput="updatePreview()">
        <input type="number" placeholder="Precio" value="${data.price}" oninput="updatePreview()">
        <button type="button" class="btn btn-danger" style="padding:0.2rem 0.5rem" onclick="this.parentElement.remove(); updatePreview();">×</button>
    `;
    list.appendChild(row);
};

function resetEditor() {
    document.getElementById('editor-title').textContent = "Nuevo Platillo";
    document.getElementById('delete-product-btn').style.display = "none";
    document.getElementById('product-form').reset();
    document.getElementById('dishId').value = "";
    document.getElementById('variants-list').innerHTML = "";
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

    // Collect tags
    const tags = Array.from(document.querySelectorAll('input[name="tags"]:checked')).map(cb => cb.value);

    // Collect variants
    const variantRows = document.querySelectorAll('.variant-row');
    const variants = Array.from(variantRows).map(row => {
        const inputs = row.querySelectorAll('input');
        return { name: inputs[0].value, price: Number(inputs[1].value) };
    }).filter(v => v.name && v.price);

    // Prepare description (JSON if variants exist)
    let description = description_text;
    if (variants.length > 0) {
        description = JSON.stringify({
            main_description: description_text,
            variants: variants
        });
    }

    const payload = { name, price, category_id, description, image_url, featured, tags };

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

    // Collect current form data for a "virtual" product
    const name = document.getElementById('name').value || "Nombre del Platillo";
    const price = Number(document.getElementById('price').value) || 0;
    const description_text = document.getElementById('description').value || "Descripción breve...";
    const image_url = document.getElementById('image').value || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80";
    const featured = document.getElementById('featured').checked;
    const tags = Array.from(document.querySelectorAll('input[name="tags"]:checked')).map(cb => cb.value);

    const variantRows = document.querySelectorAll('.variant-row');
    const variants = Array.from(variantRows).map(row => {
        const inputs = row.querySelectorAll('input');
        return { name: inputs[0].value, price: Number(inputs[1].value) };
    }).filter(v => v.name && v.price);

    let description = description_text;
    if (variants.length > 0) {
        description = JSON.stringify({ main_description: description_text, variants });
    }

    const virtualProduct = {
        id: 'preview-id',
        name,
        price,
        description,
        image_url,
        featured,
        tags,
        category_id: document.getElementById('category').value
    };

    // Send to iframe
    iframe.contentWindow.postMessage({ type: 'PREVIEW_UPDATE', product: virtualProduct }, '*');
}

window.refreshPreview = () => {
    initPreview();
    setTimeout(updatePreview, 1000);
};

window.openCategoryModal = () => {
    const name = prompt("Nombre de la nueva categoría:");
    if (name) {
        window.supabaseClient.from('categories').insert([{ name }]).then(refreshData);
    }
};

window.manageCategories = () => {
    const message = allCategories.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
    const choice = prompt(`Categorías existentes:\n${message}\n\nEscribe el número de la categoría que quieres BORRAR (o cancela):`);

    if (choice) {
        const idx = parseInt(choice) - 1;
        if (allCategories[idx]) {
            const cat = allCategories[idx];
            const hasProducts = allProducts.some(p => p.category_id === cat.id);
            if (hasProducts) {
                alert("No puedes borrar una categoría que tiene platillos. Mueve o borra los platillos primero.");
                return;
            }
            if (confirm(`¿Borrar categoría "${cat.name}"?`)) {
                window.supabaseClient.from('categories').delete().eq('id', cat.id).then(refreshData);
            }
        }
    }
};

window.updatePreviewMode = (val) => {
    const frame = document.querySelector('.preview-frame');
    if (val === 'mobile') {
        frame.style.width = '450px';
    } else {
        frame.style.width = '100%';
    }
};

window.resetEditor = resetEditor;
