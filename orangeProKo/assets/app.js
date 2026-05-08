const DATA_ROOT = "./data";
const state = {
    menu: {},
    index: {},
    zh: {},
    ko: {},
    tree: [],
    byId: new Map(),
    childrenById: new Map(),
    activeId: null,
    query: "",
    locale: localStorage.getItem("orangeDocs.locale") || "ko",
};

const navEl = document.getElementById("nav");
const pageEl = document.getElementById("page");
const searchEl = document.getElementById("search");
const breadcrumbEl = document.getElementById("breadcrumb");
const appEl = document.getElementById("app");
const toggleEl = document.getElementById("sidebarToggle");
const scrollEl = document.querySelector(".dashboard-container");
const languageToggleEl = document.getElementById("languageToggle");

main().catch((error) => {
    console.error(error);
    pageEl.innerHTML = `<p class="error">문서를 불러오지 못했습니다.</p>`;
});

async function main() {
    pageEl.innerHTML = `<p class="loading">불러오는 중...</p>`;

    const [menu, index, zh, ko] = await Promise.all([
        fetchJson(`${DATA_ROOT}/menu.json`),
        fetchJson(`${DATA_ROOT}/content-index.json`),
        fetchJson(`${DATA_ROOT}/zh-CN.json`),
        fetchJson(`${DATA_ROOT}/ko-KR.json`),
    ]);

    state.menu = menu;
    state.index = index;
    state.zh = zh;
    state.ko = ko;
    buildTree();
    bindEvents();
    route();
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status}`);
    }
    return response.json();
}

function buildTree() {
    const items = Object.values(state.menu)
        .filter((item) => item && item.type === "menu")
        .map((item) => ({
            ...item,
            id: String(item.id),
            pre_id: item.pre_id == null ? null : String(item.pre_id),
            children: [],
        }));

    state.byId = new Map(items.map((item) => [item.id, item]));
    state.childrenById = new Map();

    for (const item of items) {
        const bucketKey = item.pre_id || "__root__";
        if (!state.childrenById.has(bucketKey)) {
            state.childrenById.set(bucketKey, []);
        }
        state.childrenById.get(bucketKey).push(item);
    }

    for (const group of state.childrenById.values()) {
        group.sort(compareMenu);
    }

    for (const item of items) {
        item.children = state.childrenById.get(item.id) || [];
    }

    state.tree = state.childrenById.get("__root__") || [];
}

function compareMenu(a, b) {
    const sortA = Number.parseInt(a.sort_number || "0", 10);
    const sortB = Number.parseInt(b.sort_number || "0", 10);
    if (sortA !== sortB) return sortA - sortB;
    return Number(a.id) - Number(b.id);
}

function bindEvents() {
    window.addEventListener("hashchange", route);

    languageToggleEl.checked = state.locale !== "zh";
    languageToggleEl.addEventListener("change", () => {
        state.locale = languageToggleEl.checked ? "ko" : "zh";
        localStorage.setItem("orangeDocs.locale", state.locale);
        renderNav();
        renderPage(state.activeId);
    });

    searchEl.addEventListener("input", () => {
        state.query = searchEl.value.trim().toLowerCase();
        renderNav();
    });

    toggleEl.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 900px)").matches) {
            appEl.classList.toggle("mobile-open");
        } else {
            appEl.classList.toggle("collapsed");
        }
    });
}

function route() {
    const hash = window.location.hash || "#/home";
    const id = extractId(hash) || findFirstContentId();
    state.activeId = id;
    renderNav();
    renderPage(id);
    resetPageScroll();

    if (window.matchMedia("(max-width: 900px)").matches) {
        appEl.classList.remove("mobile-open");
    }
}

function extractId(hash) {
    const match = hash.match(/\/(?:home|page)\/?(\d+)?/);
    if (match && match[1] && state.byId.has(match[1])) {
        return match[1];
    }
    return null;
}

function findFirstContentId() {
    const root = state.tree.find((item) => hasContent(item.id));
    if (root) return root.id;

    for (const item of state.byId.values()) {
        if (hasContent(item.id)) return item.id;
    }

    return state.tree[0]?.id || null;
}

function hasContent(id) {
    return Boolean(
        state.ko[`content.${id}.body`] ||
        state.zh[`content.${id}.body`] ||
        state.index[id]?.status === "ok",
    );
}

function renderNav() {
    navEl.classList.toggle("filtering", Boolean(state.query));
    navEl.innerHTML = "";

    if (state.query) {
        navEl.appendChild(renderFilteredTree(state.tree, 0));
        return;
    }

    navEl.appendChild(renderTree(state.tree, 0));
}

function renderTree(items, depth) {
    const list = document.createElement("ul");
    list.className = "menu-list";

    for (const item of items) {
        list.appendChild(renderTreeItem(item, depth, true));
    }

    return list;
}

function renderFilteredTree(items, depth) {
    const list = document.createElement("ul");
    list.className = "menu-list";

    for (const item of items) {
        const matches = matchesQuery(item);
        const childList = renderFilteredTree(item.children, depth + 1);
        if (matches || childList.childElementCount > 0) {
            const node = renderTreeItem(item, depth, false);
            const oldChildren = node.querySelector(":scope > .menu-list");
            if (oldChildren) oldChildren.remove();
            if (childList.childElementCount > 0) {
                node.appendChild(childList);
            }
            list.appendChild(node);
        }
    }

    return list;
}

function renderTreeItem(item, depth, includeAllChildren) {
    const itemEl = document.createElement("li");
    const isActive = item.id === state.activeId;
    const isBranch = isActiveBranch(item.id);
    const hasChildren = item.children.length > 0;

    itemEl.className = [
        "menu-item",
        hasChildren && isBranch ? "open" : "",
        isBranch ? "active-branch" : "",
    ]
        .filter(Boolean)
        .join(" ");

    const row = document.createElement("a");
    row.className = `menu-row depth-${Math.min(depth, 5)}${isActive ? " active" : ""}`;
    row.href = `#/home/${item.id}`;
    row.title = getMenuName(item);

    const label = document.createElement("span");
    label.className = "menu-label";
    label.textContent = getMenuName(item);
    row.appendChild(label);

    if (hasChildren) {
        const arrow = document.createElement("span");
        arrow.className = "menu-arrow";
        arrow.textContent = "›";
        row.appendChild(arrow);

        row.addEventListener("click", (event) => {
            if (!hasContent(item.id) || event.altKey) {
                event.preventDefault();
                itemEl.classList.toggle("open");
            }
        });
    }

    itemEl.appendChild(row);

    if (hasChildren && includeAllChildren) {
        itemEl.appendChild(renderTree(item.children, depth + 1));
    }

    return itemEl;
}

function matchesQuery(item) {
    const haystack = [
        getMenuName(item),
        getTitle(item.id),
        stripHtml(getBody(item.id)),
    ]
        .join(" ")
        .toLowerCase();

    return haystack.includes(state.query);
}

function isActiveBranch(id) {
    let current = state.byId.get(state.activeId);
    while (current) {
        if (current.id === id) return true;
        current = current.pre_id ? state.byId.get(current.pre_id) : null;
    }
    return false;
}

function renderPage(id) {
    if (!id) {
        pageEl.innerHTML = `<p class="empty">표시할 문서가 없습니다.</p>`;
        breadcrumbEl.textContent = "";
        return;
    }

    const title = getTitle(id);
    const body = getBody(id);
    document.title = `${title || getMenuName(state.byId.get(id))} - 도움말 센터`;
    renderBreadcrumb(id);

    if (!body) {
        pageEl.innerHTML = `<p class="empty">이 항목에는 아직 본문이 없습니다.</p>`;
        return;
    }

    pageEl.innerHTML = body;
}

function resetPageScroll() {
    if (scrollEl) {
        scrollEl.scrollTo({ top: 0, left: 0 });
    }
    window.scrollTo({ top: 0, left: 0 });
}

function renderBreadcrumb(id) {
    const chain = [];
    let current = state.byId.get(id);
    while (current) {
        chain.unshift(current);
        current = current.pre_id ? state.byId.get(current.pre_id) : null;
    }

    breadcrumbEl.innerHTML = chain
        .map((item, index) => {
            const label = escapeHtml(getMenuName(item));
            if (index === chain.length - 1) return `<strong>${label}</strong>`;
            return `<a href="#/home/${item.id}">${label}</a><span>/</span>`;
        })
        .join("");
}

function getMenuName(item) {
    if (!item) return "";
    return getLocalized(`menu.${item.id}.name`) || item.name || "";
}

function getTitle(id) {
    return (
        getLocalized(`content.${id}.title`) ||
        state.index[id]?.title ||
        getMenuName(state.byId.get(id))
    );
}

function getBody(id) {
    return getLocalized(`content.${id}.body`) || "";
}

function getLocalized(key) {
    if (state.locale === "zh") {
        return state.zh[key] || state.ko[key] || "";
    }
    return state.ko[key] || state.zh[key] || "";
}

function normalizeBody(html) {
    return String(html)
        .replace(
            /&lt;video&gt;([\s\S]*?)&lt;\/video&gt;/g,
            '<p><span class="video-token">$1</span></p>',
        )
        .replace(
            /<video>([\s\S]*?)<\/video>/g,
            '<p><span class="video-token">$1</span></p>',
        );
}

function stripHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = html;
    return template.content.textContent || "";
}

function escapeHtml(value) {
    return String(value).replace(
        /[&<>"']/g,
        (char) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[char],
    );
}
