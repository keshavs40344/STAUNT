// VASTUDA — Independent AI Discovery & Neural Web Engine Client Logic

document.addEventListener("DOMContentLoaded", () => {
  // Centralized Backend Resolution: Route traffic to active verified backend (same origin for Vercel/local)
  const API_BASE = (window.STAUNT_BACKEND_URL !== undefined) ? window.STAUNT_BACKEND_URL : "";

  async function apiFetch(path, options) {
    if (API_BASE && typeof path === "string" && path.startsWith("/api/")) {
      const fullUrl = `${API_BASE}${path}`;
      try {
        const resp = await fetch(fullUrl, options);
        if (resp.ok) return resp;
      } catch (err) {
        console.warn(`[STAUNT] Backend request to ${fullUrl} failed, falling back to local:`, err);
      }
    }
    return fetch(path, options);
  }

  // State
  let currentQuery = "";
  let activeTab = "all";
  let currentUser = null;
  let userCollections = [];
  let pendingSaveItem = null;
  let currentReaderFontSize = 1.15; // rem

  function safeOn(el, event, handler) {
    if (el) el.addEventListener(event, handler);
  }

  // DOM Elements - Navigation & Header
  const header = document.querySelector(".app-header");
  const brandLogo = document.getElementById("brandLogo");
  const homeView = document.getElementById("homeView");
  const resultsView = document.getElementById("resultsView");
  const headerSearchWrap = document.getElementById("headerSearchWrap");

  const homeInput = document.getElementById("homeSearchInput");
  const homeForm = document.getElementById("homeSearchForm");
  const homeClearBtn = document.getElementById("homeClearBtn");
  const homeVoiceBtn = document.getElementById("homeVoiceBtn");

  const headerInput = document.getElementById("headerSearchInput");
  const headerForm = document.getElementById("headerSearchForm");
  const headerClearBtn = document.getElementById("headerClearBtn");
  const headerVoiceBtn = document.getElementById("headerVoiceBtn");

  const suggestBoxHome = document.getElementById("suggestBoxHome");
  const suggestBoxHeader = document.getElementById("suggestBoxHeader");

  const tabBtns = document.querySelectorAll(".tab-btn");
  const themeToggle = document.getElementById("themeToggle");
  const userAuthBtn = document.getElementById("userAuthBtn");
  const userAuthText = document.getElementById("userAuthText");
  const dashboardBtn = document.getElementById("dashboardBtn");

  // Results Sections
  const instantAnswerCard = document.getElementById("instantAnswerCard");
  const directAnswerCard = document.getElementById("directAnswerCard");
  const calcExpr = document.getElementById("calcExpr");
  const calcResult = document.getElementById("calcResult");

  const destinationCard = document.getElementById("destinationCard");
  const destHeroImgWrap = document.getElementById("destHeroImgWrap");
  const destHeroImg = document.getElementById("destHeroImg");
  const destTitle = document.getElementById("destTitle");
  const destCountry = document.getElementById("destCountry");
  const destWeather = document.getElementById("destWeather");
  const destTagline = document.getElementById("destTagline");
  const destBestTime = document.getElementById("destBestTime");
  const destDuration = document.getElementById("destDuration");
  const destAttractions = document.getElementById("destAttractions");
  const destMapsBtn = document.getElementById("destMapsBtn");
  const destHotelsBtn = document.getElementById("destHotelsBtn");
  const destFlightsBtn = document.getElementById("destFlightsBtn");

  const visualStripContainer = document.getElementById("visualStripContainer");
  const visualStripScroll = document.getElementById("visualStripScroll");
  const visualStripMoreBtn = document.getElementById("visualStripMoreBtn");

  const aiOverviewCard = document.getElementById("aiOverviewCard");

  const aiContent = document.getElementById("aiContent") || document.getElementById("aiOverviewBody");
  const aiSources = document.getElementById("aiSources") || document.getElementById("aiSourcesList");
  const copyOverviewBtn = document.getElementById("copyOverviewBtn");

  const researchCard = document.getElementById("researchCard");
  const researchHeading = document.getElementById("researchHeading");
  const researchSummary = document.getElementById("researchSummary");
  const researchFindings = document.getElementById("researchFindings");
  const researchMethodology = document.getElementById("researchMethodology");
  const researchLimitations = document.getElementById("researchLimitations");

  // Entity Profile Card Elements
  const entityProfileCard = document.getElementById("entityProfileCard");
  const entityAvatarWrap = document.getElementById("entityAvatarWrap");
  const entityAvatar = document.getElementById("entityAvatar");
  const entityName = document.getElementById("entityName");
  const entityRole = document.getElementById("entityRole");
  const entityConfidence = document.getElementById("entityConfidence");
  const entityBio = document.getElementById("entityBio");
  const entityWebsiteBtn = document.getElementById("entityWebsiteBtn");
  const entityWikiBtn = document.getElementById("entityWikiBtn");
  const entityProfilesSection = document.getElementById("entityProfilesSection");
  const entityProfilesGrid = document.getElementById("entityProfilesGrid");
  const entityMediaClusters = document.getElementById("entityMediaClusters");
  const entityNewsCluster = document.getElementById("entityNewsCluster");
  const entityNewsList = document.getElementById("entityNewsList");
  const entityVideosCluster = document.getElementById("entityVideosCluster");
  const entityVideosList = document.getElementById("entityVideosList");

  const webResultsSection = document.getElementById("webResultsSection") || document.getElementById("searchResultsList");
  const codeSection = document.getElementById("codeSection");
  const docsSection = document.getElementById("docsSection");
  const shoppingSection = document.getElementById("shoppingSection");
  const jobsSection = document.getElementById("jobsSection");
  const videosSection = document.getElementById("videosSection");
  const imagesSection = document.getElementById("imagesSection");
  const emptyState = document.getElementById("emptyState");
  const emptyIcon = document.getElementById("emptyIcon");
  const emptyTitle = document.getElementById("emptyTitle");
  const emptyDesc = document.getElementById("emptyDesc");
  const emptySwitchAllBtn = document.getElementById("emptySwitchAllBtn");
  const emptyRetryBtn = document.getElementById("emptyRetryBtn");
  const emptyTipsCard = document.getElementById("emptyTipsCard");
  const relatedQueriesCard = document.getElementById("relatedQueriesCard");
  const relatedQueriesList = document.getElementById("relatedQueriesList");
  const knowledgeCard = document.getElementById("knowledgeCard");
  const kcTitle = document.getElementById("kcTitle");
  const kcSnippet = document.getElementById("kcSnippet");
  const kcImg = document.getElementById("kcImg");
  const kcImgWrap = document.getElementById("kcImgWrap");
  const kcLink = document.getElementById("kcLink");
  const paginationBar = document.getElementById("paginationBar");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const pageIndicator = document.getElementById("pageIndicator");

  // Modals
  const authModal = document.getElementById("authModal");
  const closeAuthModal = document.getElementById("closeAuthModal");
  const tabSignIn = document.getElementById("tabSignIn");
  const tabRegister = document.getElementById("tabRegister");
  const authForm = document.getElementById("authForm");
  const nameGroup = document.getElementById("nameGroup");
  const authName = document.getElementById("authName");
  const authEmail = document.getElementById("authEmail");
  const authPassword = document.getElementById("authPassword");
  const authSubmitBtn = document.getElementById("authSubmitBtn");
  const authErrorMsg = document.getElementById("authErrorMsg");

  const dashboardModal = document.getElementById("dashboardModal");
  const closeDashboardModal = document.getElementById("closeDashboardModal");
  const dashAvatar = document.getElementById("dashAvatar");
  const dashUserName = document.getElementById("dashUserName");
  const dashUserEmail = document.getElementById("dashUserEmail");
  const dashTabs = document.querySelectorAll(".dash-tab");
  const dashPanes = document.querySelectorAll(".dash-view-pane");

  const collectionsGrid = document.getElementById("collectionsGrid");
  const newCollectionBtn = document.getElementById("newCollectionBtn");
  const historyList = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const toggleHistoryBtn = document.getElementById("toggleHistoryBtn");
  const savedResultsList = document.getElementById("savedResultsList");
  const savedFilterSelect = document.getElementById("savedFilterSelect");

  const prefSafeSearch = document.getElementById("prefSafeSearch");
  const prefNewTab = document.getElementById("prefNewTab");
  const prefHistoryEnabled = document.getElementById("prefHistoryEnabled");
  const prefPersonalized = document.getElementById("prefPersonalized");
  const exportDataBtn = document.getElementById("exportDataBtn");
  const signOutBtn = document.getElementById("signOutBtn");

  const saveResultModal = document.getElementById("saveResultModal");
  const closeSaveResultModal = document.getElementById("closeSaveResultModal");
  const saveItemTitle = document.getElementById("saveItemTitle");
  const saveCollectionSelect = document.getElementById("saveCollectionSelect");
  const confirmSaveBtn = document.getElementById("confirmSaveBtn");

  const readerModal = document.getElementById("readerModal");
  const closeReaderBtn = document.getElementById("closeReaderBtn");
  const readerTitle = document.getElementById("readerTitle");
  const readerBody = document.getElementById("readerBody");
  const readerDomainBadge = document.getElementById("readerDomainBadge");
  const readerTimeBadge = document.getElementById("readerTimeBadge");
  const readerExternalLink = document.getElementById("readerExternalLink");
  const readerFontDec = document.getElementById("readerFontDec");
  const readerFontInc = document.getElementById("readerFontInc");

  const lightboxModal = document.getElementById("lightboxModal");
  const closeLightboxBtn = document.getElementById("closeLightboxBtn");
  const lightboxImg = document.getElementById("lightboxImg");
  const lightboxTitle = document.getElementById("lightboxTitle");
  const lightboxDomain = document.getElementById("lightboxDomain");
  const lightboxVisitBtn = document.getElementById("lightboxVisitBtn");
  const lightboxRawImgBtn = document.getElementById("lightboxRawImgBtn");

  // --- Theme Management ---
  const savedTheme = localStorage.getItem("vastuda_theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);

  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("vastuda_theme", next);
    updateThemeIcon(next);
  });

  function updateThemeIcon(theme) {
    themeToggle.innerHTML = theme === "dark" 
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }

  // --- Clear Buttons Setup ---
  function setupClearBtn(input, btn) {
    if (!input || !btn) return;
    input.addEventListener("input", () => {
      btn.style.display = input.value.length > 0 ? "flex" : "none";
    });
    btn.addEventListener("click", () => {
      input.value = "";
      btn.style.display = "none";
      input.focus();
    });
  }
  setupClearBtn(homeInput, homeClearBtn);
  setupClearBtn(headerInput, headerClearBtn);

  function returnToHome(pushHistory = true) {
    document.body.classList.remove("in-search-mode");
    if (resultsView) {
      resultsView.classList.remove("active");
      resultsView.style.display = "none";
    }
    if (homeView) homeView.style.display = "flex";
    if (headerSearchWrap) headerSearchWrap.style.display = "none";
    if (homeInput) homeInput.value = "";
    if (headerInput) headerInput.value = "";
    currentQuery = "";
    if (paginationBar) paginationBar.style.display = "none";
    if (pushHistory && (window.location.search || window.location.pathname !== "/")) {
      try {
        window.history.pushState({ home: true }, "", "/");
      } catch (e) {}
    }
  }

  // Logo returns to home view
  brandLogo.addEventListener("click", () => {
    returnToHome(true);
  });

  // --- Guest Local Search History (Phase 4 & 11) ---
  const GUEST_HISTORY_KEY = "vastuda_guest_history";

  function getGuestHistory() {
    try {
      return JSON.parse(localStorage.getItem(GUEST_HISTORY_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function addGuestHistory(query, category = "all") {
    if (!query || query.trim().length === 0) return;
    const cleanQ = query.trim();
    let history = getGuestHistory();
    history = history.filter(item => item.query.toLowerCase() !== cleanQ.toLowerCase());
    history.unshift({ query: cleanQ, category, timestamp: Date.now() });
    if (history.length > 30) history = history.slice(0, 30);
    try {
      localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {}
    renderHomeRecentSearches();
  }

  function clearGuestHistory() {
    try {
      localStorage.removeItem(GUEST_HISTORY_KEY);
    } catch (e) {}
    renderHomeRecentSearches();
  }

  function renderHomeRecentSearches() {
    const wrap = document.getElementById("homeRecentWrap");
    const chipsContainer = document.getElementById("homeRecentChips");
    if (!wrap || !chipsContainer) return;

    const history = getGuestHistory();
    if (history.length === 0) {
      wrap.style.display = "none";
      chipsContainer.innerHTML = "";
      return;
    }

    wrap.style.display = "block";
    chipsContainer.innerHTML = history.slice(0, 8).map(item => `
      <button class="home-recent-chip" type="button" data-q="${escapeHtml(item.query)}" data-cat="${escapeHtml(item.category || 'all')}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>${escapeHtml(item.query)}</span>
      </button>
    `).join("");

    chipsContainer.querySelectorAll(".home-recent-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const q = chip.getAttribute("data-q");
        const cat = chip.getAttribute("data-cat") || "all";
        homeInput.value = q;
        headerInput.value = q;
        executeSearch(q, cat, currentTimeFilter);
      });
    });
  }

  const clearHomeRecentBtn = document.getElementById("clearHomeRecentBtn");
  if (clearHomeRecentBtn) {
    clearHomeRecentBtn.addEventListener("click", clearGuestHistory);
  }
  renderHomeRecentSearches();

  // --- Functional Search Vertical Shortcuts (Phase 10) ---
  const homeVerticalShortcuts = document.getElementById("homeVerticalShortcuts");
  if (homeVerticalShortcuts) {
    homeVerticalShortcuts.querySelectorAll("button.pill").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        const currentVal = homeInput.value.trim();
        if (currentVal) {
          executeSearch(currentVal, tab, currentTimeFilter);
        } else {
          activeTab = tab;
          tabBtns.forEach(b => {
            b.classList.toggle("active", b.getAttribute("data-tab") === tab);
          });
          const span = btn.querySelector("span");
          homeInput.placeholder = `Search in ${span ? span.textContent : tab}...`;
          homeInput.focus();
        }
      });
    });
  }

  // --- Header Apps Menu & Quick Settings (Phase 12 & 13) ---
  const appsMenuDropdown = document.getElementById("appsMenuDropdown");
  const menuOpenDashboard = document.getElementById("menuOpenDashboard");
  const menuOpenSettings = document.getElementById("menuOpenSettings");

  if (dashboardBtn && appsMenuDropdown) {
    safeOn(dashboardBtn, "click", (e) => {
      e.stopPropagation();
      const isVisible = appsMenuDropdown.style.display === "block";
      appsMenuDropdown.style.display = isVisible ? "none" : "block";
    });

    document.addEventListener("click", (e) => {
      if (appsMenuDropdown && !appsMenuDropdown.contains(e.target) && e.target !== dashboardBtn) {
        appsMenuDropdown.style.display = "none";
      }
    });
  }

  if (menuOpenDashboard) {
    menuOpenDashboard.addEventListener("click", () => {
      if (appsMenuDropdown) appsMenuDropdown.style.display = "none";
      openDashboard();
    });
  }

  if (menuOpenSettings) {
    menuOpenSettings.addEventListener("click", () => {
      if (appsMenuDropdown) appsMenuDropdown.style.display = "none";
      if (!currentUser) {
        dashboardModal.classList.add("open");
        dashTabs.forEach(t => t.classList.remove("active"));
        dashPanes.forEach(p => p.classList.remove("active"));
        const prefTab = document.querySelector('.dash-tab[data-view="preferences"]');
        const prefPane = document.getElementById("panePreferences");
        if (prefTab) prefTab.classList.add("active");
        if (prefPane) prefPane.classList.add("active");
      } else {
        openDashboard();
        const prefTab = document.querySelector('.dash-tab[data-view="preferences"]');
        if (prefTab) prefTab.click();
      }
    });
  }

  // --- Voice Search Support ---
  function setupVoiceSearch(btn, input) {
    if (!btn || !input) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      btn.style.display = "none";
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    btn.addEventListener("click", () => {
      btn.style.color = "#ff453a";
      recognition.start();
    });

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      input.value = transcript;
      btn.style.color = "";
      executeSearch(transcript, activeTab, currentTimeFilter);
    };

    recognition.onerror = () => {
      btn.style.color = "";
    };
    recognition.onend = () => {
      btn.style.color = "";
    };
  }
  setupVoiceSearch(homeVoiceBtn, homeInput);
  setupVoiceSearch(headerVoiceBtn, headerInput);

  // --- Search Suggestions with Full Keyboard Navigation (Phase 3) ---
  function setupSuggestions(input, box) {
    if (!input || !box) return;
    let timeout = null;
    let selectedIndex = -1;
    let currentItems = [];

    function renderSuggestions(items, isRecent = false) {
      currentItems = items || [];
      selectedIndex = -1;
      if (currentItems.length === 0) {
        box.classList.remove("active");
        box.innerHTML = "";
        return;
      }
      box.innerHTML = currentItems.map((s, idx) => `
        <div class="suggest-item ${isRecent ? 'recent-type' : ''}" data-idx="${idx}">
          ${isRecent ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>'}
          <span>${escapeHtml(s)}</span>
        </div>
      `).join("");
      box.classList.add("active");

      box.querySelectorAll(".suggest-item").forEach((item) => {
        item.addEventListener("click", () => {
          const idx = parseInt(item.getAttribute("data-idx"), 10);
          const text = currentItems[idx];
          input.value = text;
          box.classList.remove("active");
          executeSearch(text, activeTab, currentTimeFilter);
        });
      });
    }

    // Show recent searches on focus when input is empty
    input.addEventListener("focus", () => {
      if (input.value.trim().length === 0) {
        const recents = getGuestHistory().slice(0, 5).map(h => h.query);
        if (recents.length > 0) {
          renderSuggestions(recents, true);
        }
      }
    });

    input.addEventListener("input", () => {
      const val = input.value.trim();
      clearTimeout(timeout);
      if (val.length === 0) {
        const recents = getGuestHistory().slice(0, 5).map(h => h.query);
        if (recents.length > 0) {
          renderSuggestions(recents, true);
        } else {
          box.classList.remove("active");
          box.innerHTML = "";
        }
        return;
      }
      if (val.length < 2) {
        box.classList.remove("active");
        box.innerHTML = "";
        return;
      }
      timeout = setTimeout(async () => {
        try {
          const resp = await apiFetch(`/api/suggest?q=${encodeURIComponent(val)}`);
          const items = await resp.json();
          renderSuggestions(items, false);
        } catch (e) {
          box.classList.remove("active");
        }
      }, 150);
    });

    input.addEventListener("keydown", (e) => {
      if (!box.classList.contains("active") || currentItems.length === 0) {
        if (e.key === "Escape") box.classList.remove("active");
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % currentItems.length;
        updateSelection();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
        updateSelection();
      } else if (e.key === "Enter") {
        if (selectedIndex >= 0 && selectedIndex < currentItems.length) {
          e.preventDefault();
          const text = currentItems[selectedIndex];
          input.value = text;
          box.classList.remove("active");
          executeSearch(text, activeTab, currentTimeFilter);
        }
      } else if (e.key === "Escape") {
        box.classList.remove("active");
      }
    });

    function updateSelection() {
      const domItems = box.querySelectorAll(".suggest-item");
      domItems.forEach((el, idx) => {
        if (idx === selectedIndex) {
          el.classList.add("selected");
          el.classList.add("highlighted");
          input.value = currentItems[idx];
        } else {
          el.classList.remove("selected");
          el.classList.remove("highlighted");
        }
      });
    }

    document.addEventListener("click", (e) => {
      if (!input.contains(e.target) && !box.contains(e.target)) {
        box.classList.remove("active");
      }
    });
  }
  setupSuggestions(homeInput, suggestBoxHome);
  setupSuggestions(headerInput, suggestBoxHeader);

  // --- Homepage Vertical Navigation Modes ---
  const homeModeBtns = document.querySelectorAll(".mode-nav-btn");
  homeModeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      homeModeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.getAttribute("data-tab") || "all";
      activeTab = tab;
      const q = homeInput.value.trim();
      if (q) {
        headerInput.value = q;
        executeSearch(q, activeTab, currentTimeFilter);
      } else {
        homeInput.focus();
      }
    });
  });

  // --- Category Tabs Switching (Results Page & Header Navigation) ---
  const topCatBtns = document.querySelectorAll(".top-cat-btn");

  function switchTab(tab) {
    if (!tab) return;
    activeTab = tab;
    tabBtns.forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-tab") === tab);
    });
    topCatBtns.forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-tab") === tab);
    });
    const q = (currentQuery || (homeInput ? homeInput.value : "")).trim();
    if (q) {
      executeSearch(q, tab, currentTimeFilter);
    }
  }

  topCatBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      if (tab) {
        switchTab(tab);
      }
    });
  });

  const moreCatBtn = document.getElementById("moreCatBtn");
  const moreCatMenu = document.getElementById("moreCatMenu");
  if (moreCatBtn && moreCatMenu) {
    moreCatBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      moreCatMenu.classList.toggle("open");
    });
    document.addEventListener("click", () => {
      moreCatMenu.classList.remove("open");
    });
  }

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      switchTab(tab);
    });
  });

  // --- Search Filters Dropdown (UI/UX 2.0) ---
  let currentTimeFilter = "";
  const filterTimeBtn = document.getElementById("filterTimeBtn");
  const filterTimeMenu = document.getElementById("filterTimeMenu");
  const filterTimeLabel = document.getElementById("filterTimeLabel");
  const filterMenuItems = document.querySelectorAll(".filter-menu-item");
  const filterChips = document.querySelectorAll(".filter-chip");
  const resultsCountNotice = document.getElementById("resultsCountNotice");

  if (filterTimeBtn && filterTimeMenu) {
    filterTimeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = filterTimeMenu.style.display === "block";
      filterTimeMenu.style.display = isVisible ? "none" : "block";
      filterTimeBtn.setAttribute("aria-expanded", String(!isVisible));
    });

    filterMenuItems.forEach(item => {
      item.addEventListener("click", () => {
        filterMenuItems.forEach(m => m.classList.remove("active"));
        item.classList.add("active");
        currentTimeFilter = item.getAttribute("data-time") || "";
        if (filterTimeLabel) {
          filterTimeLabel.textContent = item.textContent.trim();
        }
        filterTimeMenu.style.display = "none";
        filterTimeBtn.setAttribute("aria-expanded", "false");
        if (currentQuery) {
          executeSearch(currentQuery, activeTab, currentTimeFilter);
        }
      });
    });

    document.addEventListener("click", (e) => {
      if (!filterTimeBtn.contains(e.target) && !filterTimeMenu.contains(e.target)) {
        filterTimeMenu.style.display = "none";
        filterTimeBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Fallback for filter chips if present
  filterChips.forEach(chip => {
    chip.addEventListener("click", () => {
      filterChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      currentTimeFilter = chip.getAttribute("data-time") || "";
      if (currentQuery) {
        executeSearch(currentQuery, activeTab, currentTimeFilter);
      }
    });
  });

  if (visualStripMoreBtn) {
    visualStripMoreBtn.addEventListener("click", () => {
      const imgTab = document.querySelector('button.tab-btn[data-tab="images"]');
      if (imgTab) imgTab.click();
    });
  }


  // --- Search Forms Submission ---
  homeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = homeInput.value.trim();
    if (q) {
      headerInput.value = q;
      executeSearch(q, activeTab);
    }
  });

  headerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = headerInput.value.trim();
    if (q) {
      homeInput.value = q;
      executeSearch(q, activeTab);
    }
  });

  let activeSearchId = 0;
  let currentSearchPage = 1;

  // --- Core Search Execution ---
  async function executeSearch(query, category = "all", time = "", page = 1, isPopState = false) {
    activeSearchId++;
    const thisSearchId = activeSearchId;
    currentSearchPage = page || 1;

    currentQuery = query;
    activeTab = category;
    currentTimeFilter = time || "";

    // Sync tab button active states
    tabBtns.forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-tab") === category);
    });

    // Sync homepage mode buttons
    homeModeBtns.forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-tab") === category);
    });

    // Sync filter menu items and label
    filterMenuItems.forEach(m => {
      const isAct = (m.getAttribute("data-time") || "") === currentTimeFilter;
      m.classList.toggle("active", isAct);
      if (isAct && filterTimeLabel) {
        filterTimeLabel.textContent = m.textContent.trim();
      }
    });

    // Sync filter chips active states
    filterChips.forEach(c => {
      c.classList.toggle("active", (c.getAttribute("data-time") || "") === currentTimeFilter);
    });

    // Record search in guest history
    addGuestHistory(query, category);

    // Switch view to results
    document.body.classList.add("in-search-mode");
    homeView.style.display = "none";
    resultsView.style.display = "block";
    resultsView.classList.add("active");
    headerSearchWrap.style.display = "flex";
    headerInput.value = query;

    // Sync URL without reload (do not pushState during popstate event)
    if (!isPopState) {
      try {
        const url = new URL(window.location);
        url.searchParams.set("q", query);
        if (category && category !== "all") {
          url.searchParams.set("category", category);
        } else {
          url.searchParams.delete("category");
        }
        if (currentTimeFilter) {
          url.searchParams.set("time", currentTimeFilter);
        } else {
          url.searchParams.delete("time");
        }
        if (page && page > 1) {
          url.searchParams.set("page", page);
        } else {
          url.searchParams.delete("page");
        }
        if (window.location.search !== url.search) {
          window.history.pushState({ query, category, time: currentTimeFilter, page: currentSearchPage }, "", url);
        } else {
          window.history.replaceState({ query, category, time: currentTimeFilter, page: currentSearchPage }, "", url);
        }
      } catch (e) {}
    }

    // Reset section visibilities
    if (instantAnswerCard) instantAnswerCard.style.display = "none";
    if (directAnswerCard) directAnswerCard.style.display = "none";
    if (destinationCard) destinationCard.style.display = "none";
    if (destHeroImgWrap) destHeroImgWrap.style.display = "none";
    if (entityProfileCard) entityProfileCard.style.display = "none";
    if (visualStripContainer) visualStripContainer.style.display = "none";
    if (aiOverviewCard) aiOverviewCard.style.display = "none";
    if (researchCard) researchCard.style.display = "none";
    if (knowledgeCard) knowledgeCard.style.display = "none";
    if (webResultsSection) webResultsSection.style.display = "none";
    if (codeSection) codeSection.style.display = "none";
    if (docsSection) docsSection.style.display = "none";
    if (shoppingSection) shoppingSection.style.display = "none";
    if (jobsSection) jobsSection.style.display = "none";
    if (videosSection) videosSection.style.display = "none";
    if (imagesSection) imagesSection.style.display = "none";
    if (emptyState) emptyState.style.display = "none";
    if (paginationBar) paginationBar.style.display = "none";
    if (resultsCountNotice) resultsCountNotice.textContent = "Searching...";

    // Show loading skeleton in web results
    if (webResultsSection) {
      webResultsSection.style.display = "flex";
      webResultsSection.innerHTML = `
        <div class="result-skeleton-card">
          <div class="skeleton-source-row">
            <div class="skeleton-shimmer skeleton-favicon"></div>
            <div class="skeleton-shimmer skeleton-domain"></div>
          </div>
          <div class="skeleton-shimmer skeleton-title"></div>
          <div class="skeleton-shimmer skeleton-snippet-1"></div>
          <div class="skeleton-shimmer skeleton-snippet-2"></div>
        </div>
        <div class="result-skeleton-card">
          <div class="skeleton-source-row">
            <div class="skeleton-shimmer skeleton-favicon"></div>
            <div class="skeleton-shimmer skeleton-domain"></div>
          </div>
          <div class="skeleton-shimmer skeleton-title"></div>
          <div class="skeleton-shimmer skeleton-snippet-1"></div>
          <div class="skeleton-shimmer skeleton-snippet-2"></div>
        </div>
        <div class="result-skeleton-card">
          <div class="skeleton-source-row">
            <div class="skeleton-shimmer skeleton-favicon"></div>
            <div class="skeleton-shimmer skeleton-domain"></div>
          </div>
          <div class="skeleton-shimmer skeleton-title"></div>
          <div class="skeleton-shimmer skeleton-snippet-1"></div>
          <div class="skeleton-shimmer skeleton-snippet-2"></div>
        </div>
      `;
    }

    try {
      let fetchUrl = `/api/search?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`;
      if (currentTimeFilter) {
        fetchUrl += `&time=${encodeURIComponent(currentTimeFilter)}`;
      }
      if (page && page > 1) {
        fetchUrl += `&page=${encodeURIComponent(page)}`;
      }
      const resp = await apiFetch(fetchUrl);
      const data = await resp.json();

      // Guard against race conditions from previous slow searches
      if (thisSearchId !== activeSearchId) {
        return;
      }

      if (webResultsSection) webResultsSection.innerHTML = "";

      // Count notification
      if (resultsCountNotice) {
        const count = (data.results || data.images || data.videos || data.documents || data.repositories || []).length;
        resultsCountNotice.textContent = "";
      }

      // Route rendering according to category
      if (category === "all") {
        renderAllCategory(data, query);
      } else if (category === "ai") {
        renderAiCategory(data, query);
      } else if (category === "research") {
        renderResearchCategory(data, query);
      } else if (category === "news") {
        renderNewsCategory(data);
      } else if (category === "images") {
        renderImagesCategory(data, query);
      } else if (category === "videos") {
        renderVideosCategory(data);
      } else if (category === "docs") {
        renderDocsCategory(data);
      } else if (category === "code") {
        renderCodeCategory(data);
      } else if (category === "shopping") {
        renderShoppingCategory(data);
      } else if (category === "jobs") {
        renderJobsCategory(data);
      } else if (category === "places" || category === "maps") {
        renderPlacesCategory(data);
      }

      // Update sidebar related queries
      updateRelatedQueries(query, data);

    } catch (err) {
      if (thisSearchId !== activeSearchId) return;
      console.error("Search failed:", err);
      showEmptyState(category, query, true, "Search request failed. Please check your network connection and try again.");
      if (resultsCountNotice) resultsCountNotice.textContent = "";
    }
  }

  // --- Category Renderers ---

  // Category-Aware Empty & Error State Helper
  function showEmptyState(category, query, isError = false, errorMsg = "") {
    if (!emptyState) return;
    emptyState.style.display = "block";
    const cleanQ = (query || "").trim();

    if (emptyIcon) emptyIcon.textContent = isError ? "⚠️" : "🔍";
    if (emptyTitle) {
      if (isError) {
        emptyTitle.textContent = "Service temporarily unavailable";
      } else if (category === "images") {
        emptyTitle.textContent = cleanQ ? `No images found for "${cleanQ}"` : "No images found";
      } else if (category === "videos") {
        emptyTitle.textContent = cleanQ ? `No videos found for "${cleanQ}"` : "No videos found";
      } else if (category === "news") {
        emptyTitle.textContent = cleanQ ? `No news articles found for "${cleanQ}"` : "No news articles found";
      } else {
        emptyTitle.textContent = cleanQ ? `No search results found for "${cleanQ}"` : "No search results found";
      }
    }
    if (emptyDesc) {
      if (isError) {
        emptyDesc.textContent = errorMsg || "We were unable to reach search providers right now. Please try again in a few moments.";
      } else if (category === "images") {
        emptyDesc.textContent = "No public image results matched your search term. You can search across All results or try broader keywords.";
      } else {
        emptyDesc.textContent = "Try checking your spelling, using more general keywords, or exploring other categories.";
      }
    }
    if (emptySwitchAllBtn) {
      emptySwitchAllBtn.style.display = (category && category !== "all") ? "inline-flex" : "none";
    }
    if (emptyTipsCard) {
      emptyTipsCard.style.display = isError ? "none" : "block";
    }
  }

  // Helper: Production Entity & Person SERP Renderer
  function renderEntityProfileCard(entity, news, videos) {
    if (!entityProfileCard) return;
    if (!entity || !entity.name) {
      entityProfileCard.style.display = "none";
      return;
    }

    if (entityName) entityName.textContent = entity.name;
    if (entityRole) entityRole.textContent = entity.role || "Notable Figure";
    if (entityConfidence) entityConfidence.textContent = `✓ ${entity.confidence || 'Verified'}`;
    if (entityBio) entityBio.textContent = entity.description || "";

    // Avatar
    if (entity.image && entityAvatar && entityAvatarWrap) {
      entityAvatar.src = entity.image;
      entityAvatarWrap.style.display = "block";
      entityAvatar.onerror = () => { if (entityAvatarWrap) entityAvatarWrap.style.display = "none"; };
    } else if (entityAvatarWrap) {
      entityAvatarWrap.style.display = "none";
    }

    // Official website button
    if (entity.official_website && entityWebsiteBtn) {
      entityWebsiteBtn.href = entity.official_website;
      entityWebsiteBtn.style.display = "inline-flex";
    } else if (entityWebsiteBtn) {
      entityWebsiteBtn.style.display = "none";
    }

    // Wikipedia button
    if (entity.wikipedia_url && entityWikiBtn) {
      entityWikiBtn.href = entity.wikipedia_url;
      entityWikiBtn.style.display = "inline-flex";
    } else if (entityWikiBtn) {
      entityWikiBtn.style.display = "none";
    }

    // Social Profiles
    const profiles = entity.profiles || [];
    if (profiles.length > 0 && entityProfilesSection && entityProfilesGrid) {
      entityProfilesGrid.innerHTML = profiles.map(p => {
        let icon = "🔗";
        if (p.platform === "x") icon = "𝕏";
        else if (p.platform === "linkedin") icon = "in";
        else if (p.platform === "instagram") icon = "📸";
        else if (p.platform === "youtube") icon = "▶";
        else if (p.platform === "github") icon = "⌨";
        else if (p.platform === "facebook") icon = "f";

        return `
          <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer" class="entity-profile-chip" title="${escapeHtml(p.title || p.platform)}: ${escapeHtml(p.handle || '')}">
            <span class="platform-icon">${icon}</span>
            <span>${escapeHtml(p.title || p.platform)}</span>
            ${p.handle ? `<span class="handle-text">${escapeHtml(p.handle)}</span>` : ''}
          </a>
        `;
      }).join("");
      entityProfilesSection.style.display = "block";
    } else if (entityProfilesSection) {
      entityProfilesSection.style.display = "none";
    }

    // Media Clusters (News & Videos)
    const hasNews = news && news.length > 0;
    const hasVideos = videos && videos.length > 0;
    if ((hasNews || hasVideos) && entityMediaClusters) {
      entityMediaClusters.style.display = "grid";

      if (hasNews && entityNewsCluster && entityNewsList) {
        entityNewsList.innerHTML = news.slice(0, 3).map(n => `
          <a href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer" class="entity-cluster-item">
            <div class="entity-cluster-text">
              <div class="entity-cluster-headline">${escapeHtml(n.title)}</div>
              <div class="entity-cluster-sub">${escapeHtml(n.domain || 'News')} • ${escapeHtml(n.published_date || '')}</div>
            </div>
          </a>
        `).join("");
        entityNewsCluster.style.display = "block";
      } else if (entityNewsCluster) {
        entityNewsCluster.style.display = "none";
      }

      if (hasVideos && entityVideosCluster && entityVideosList) {
        entityVideosList.innerHTML = videos.slice(0, 3).map(v => `
          <a href="${escapeHtml(v.url)}" target="_blank" rel="noopener noreferrer" class="entity-cluster-item">
            ${v.thumbnail ? `<img src="${escapeHtml(v.thumbnail)}" class="entity-cluster-thumb" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none'" />` : ''}
            <div class="entity-cluster-text">
              <div class="entity-cluster-headline">${escapeHtml(v.title)}</div>
              <div class="entity-cluster-sub">${escapeHtml(v.channel || 'Video')}</div>
            </div>
          </a>
        `).join("");
        entityVideosCluster.style.display = "block";
      } else if (entityVideosCluster) {
        entityVideosCluster.style.display = "none";
      }
    } else if (entityMediaClusters) {
      entityMediaClusters.style.display = "none";
    }

    entityProfileCard.style.display = "block";
  }

  // Helper: Sidebar Knowledge Card Renderer
  function renderSidebarKnowledgeCard(entity) {
    if (!knowledgeCard || !kcTitle || !kcSnippet) return;
    if (!entity || !entity.name) {
      knowledgeCard.style.display = "none";
      return;
    }
    kcTitle.textContent = entity.name;
    kcSnippet.textContent = entity.description || entity.snippet || "";
    if (entity.image && kcImg && kcImgWrap) {
      kcImg.src = entity.image;
      kcImgWrap.style.display = "block";
      kcImg.onerror = () => { if (kcImgWrap) kcImgWrap.style.display = "none"; };
    } else if (kcImgWrap) {
      kcImgWrap.style.display = "none";
    }
    if (entity.wikipedia_url && kcLink) {
      kcLink.href = entity.wikipedia_url;
      kcLink.style.display = "inline-flex";
    } else if (kcLink) {
      kcLink.style.display = "none";
    }
    knowledgeCard.style.display = "block";
  }

  // 1. ALL Category (Web Results Prioritized + Instant Answer + Sidebar Context)
  function renderAllCategory(data, query) {
    // 1. Instant Math / Calculation / Live Currency
    if (data.instant_answer && instantAnswerCard) {
      const ia = data.instant_answer;
      const headerBadge = document.getElementById("calcHeaderBadge");
      const calcSubtext = document.getElementById("calcSubtext");
      const calcFooterMeta = document.getElementById("calcFooterMeta");
      const calcSourceBadge = document.getElementById("calcSourceBadge");
      const calcDisclaimer = document.getElementById("calcDisclaimer");

      if (ia.type === "currency" && ia.details) {
        const d = ia.details;
        if (headerBadge) {
          headerBadge.textContent = "Live Currency Conversion";
          headerBadge.style.display = "inline-flex";
        }
        if (calcExpr) calcExpr.textContent = d.formatted_expression || `${d.amount} ${d.from_code} =`;
        if (calcResult) {
          calcResult.textContent = d.formatted_result || `${d.converted_amount} ${d.to_code}`;
          calcResult.className = "calc-result is-accent";
        }
        if (calcSubtext) {
          calcSubtext.textContent = `${d.rate_text} · ${d.inverse_rate_text}`;
          calcSubtext.style.display = "block";
        }
        if (calcFooterMeta) {
          if (calcSourceBadge) {
            calcSourceBadge.textContent = `Source: ${d.provider} · ${d.timestamp}${d.is_cached ? ' (Cached)' : ''}`;
          }
          if (calcDisclaimer) {
            calcDisclaimer.textContent = d.disclaimer || "Indicative exchange rate.";
          }
          calcFooterMeta.style.display = "flex";
        }
      } else {
        // Standard Calculator
        if (headerBadge) {
          headerBadge.textContent = "Calculator";
          headerBadge.style.display = "inline-flex";
        }
        if (calcExpr) calcExpr.textContent = `${ia.expression} =`;
        if (calcResult) {
          calcResult.textContent = ia.result;
          calcResult.className = ia.error ? "calc-result is-error" : "calc-result is-accent";
        }
        if (calcSubtext) {
          if (ia.steps && !ia.error) {
            calcSubtext.textContent = ia.steps;
            calcSubtext.style.display = "block";
          } else {
            calcSubtext.style.display = "none";
          }
        }
        if (calcFooterMeta) {
          calcFooterMeta.style.display = "none";
        }
      }
      instantAnswerCard.style.display = "block";
    }

    // 1.5. STAUNT Direct Answer Engine Card
    if (data.answer && directAnswerCard) {
      renderDirectAnswerCard(data.answer, query);
    } else if (directAnswerCard) {
      directAnswerCard.style.display = "none";
    }

    // 2. Compact Inline Visual Discovery Strip (Max 4 items, never for math)
    const previewImages = data.images || [];
    if (previewImages.length > 0 && !data.instant_answer && visualStripContainer && visualStripScroll) {
      visualStripScroll.innerHTML = previewImages.slice(0, 4).map(img => `
        <div class="visual-strip-item" title="${escapeHtml(img.title || query)}">
          <img src="${escapeHtml(img.thumbnail || img.url)}" alt="${escapeHtml(img.title || query)}" referrerpolicy="no-referrer" onerror="this.parentElement.style.display='none'" />
        </div>
      `).join("");
      visualStripContainer.style.display = "block";

      visualStripScroll.querySelectorAll(".visual-strip-item").forEach((el, idx) => {
        el.addEventListener("click", () => {
          const img = previewImages[idx];
          if (lightboxImg) lightboxImg.src = img.url;
          if (lightboxTitle) lightboxTitle.textContent = img.title || query;
          let domain = img.domain || "web";
          if (!domain || domain === "web") {
            try { domain = new URL(img.source_url || img.url).hostname.replace("www.", ""); } catch(e) {}
          }
          if (lightboxDomain) lightboxDomain.textContent = domain;
          if (lightboxVisitBtn) {
            lightboxVisitBtn.href = img.source_url || img.url;
            lightboxVisitBtn.textContent = img.source_url ? "Visit Source Page ↗" : "View Source ↗";
          }
          if (lightboxRawImgBtn) {
            lightboxRawImgBtn.href = img.url;
          }
          if (lightboxModal) lightboxModal.classList.add("open");
        });
      });
    } else if (visualStripContainer) {
      visualStripContainer.style.display = "none";
    }

    // 3. PRIMARY CONTENT: Real Web Search Results List
    const results = data.results || [];
    if (results.length > 0 && webResultsSection) {
      if (emptyState) emptyState.style.display = "none";
      webResultsSection.style.display = "flex";
      results.forEach(item => {
        webResultsSection.appendChild(createWebResultCard(item));
      });

      // Pagination Controls
      if (paginationBar && prevPageBtn && nextPageBtn && pageIndicator) {
        paginationBar.style.display = "flex";
        pageIndicator.textContent = `Page ${currentSearchPage}`;
        prevPageBtn.disabled = currentSearchPage <= 1;
        nextPageBtn.disabled = results.length < 10;

        prevPageBtn.onclick = () => {
          if (currentSearchPage > 1) {
            executeSearch(currentQuery, activeTab, currentTimeFilter, currentSearchPage - 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        };
        nextPageBtn.onclick = () => {
          executeSearch(currentQuery, activeTab, currentTimeFilter, currentSearchPage + 1);
          window.scrollTo({ top: 0, behavior: "smooth" });
        };
      }
    } else if (!data.instant_answer && !data.answer && previewImages.length === 0 && results.length === 0) {
      if (paginationBar) paginationBar.style.display = "none";
      showEmptyState("all", query);
    }

    // 4. Secondary Column Context: Sidebar Knowledge Card
    if (data.entity && knowledgeCard) {
      renderSidebarKnowledgeCard(data.entity);
    } else if (knowledgeCard) {
      knowledgeCard.style.display = "none";
    }
  }

  // 2. AI Category
  function renderAiCategory(data, query) {
    aiOverviewCard.style.display = "block";
    aiContent.innerHTML = formatMarkdown(data.overview || "");
    
    // Render source cards
    aiSources.innerHTML = (data.sources || []).map(s => `
      <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="source-chip" title="${escapeHtml(s.title)}">
        <span class="source-num">${s.index}</span>
        <span class="source-name">${escapeHtml(s.domain || "Source")}</span>
      </a>
    `).join("");

    // Also display web results underneath
    if (data.results && data.results.length > 0) {
      webResultsSection.style.display = "flex";
      data.results.forEach(item => {
        webResultsSection.appendChild(createWebResultCard(item));
      });
    }
  }

  // 3. Research Category
  function renderResearchCategory(data, query) {
    const research = data.research || {};
    researchCard.style.display = "block";
    researchHeading.textContent = `Scholarly Consensus: ${query}`;
    researchSummary.textContent = research.summary || "Synthesizing research evidence...";

    const findingsList = research.key_findings || [];
    researchFindings.innerHTML = findingsList.map(f => `<li>${escapeHtml(f)}</li>`).join("");

    researchMethodology.textContent = research.methodology_and_evidence || "Synthesized from peer-reviewed literature, preprints, and academic databases.";
    researchLimitations.textContent = research.counter_arguments_limitations || "Ongoing research continues to evaluate sample constraints, methodology variations, and edge cases.";

    // Render underlying research papers
    if (data.results && data.results.length > 0) {
      webResultsSection.style.display = "flex";
      data.results.forEach(item => {
        webResultsSection.appendChild(createWebResultCard(item));
      });
    }
  }

  // 4. News Category
  function renderNewsCategory(data) {
    const results = data.results || [];
    if (results.length > 0) {
      webResultsSection.style.display = "flex";
      results.forEach(item => {
        const card = createWebResultCard(item);
        if (item.published_date) {
          const datePill = document.createElement("span");
          datePill.className = "dest-stat-pill";
          datePill.style.fontSize = "0.75rem";
          datePill.textContent = item.published_date;
          card.querySelector(".result-meta")?.appendChild(datePill);
        }
        webResultsSection.appendChild(card);
      });
    } else {
      emptyState.style.display = "block";
    }
  }

  // 5. Images Category (Phase 6)
  function renderImagesCategory(data, query) {
    imagesSection.style.display = "grid";
    imagesSection.innerHTML = "";
    const images = data.images || [];
    if (images.length > 0) {
      if (emptyState) emptyState.style.display = "none";
      images.forEach(img => {
        const item = document.createElement("div");
        item.className = "image-card-box";
        
        let domain = img.domain || "web";
        if (!domain || domain === "web") {
          try {
            domain = new URL(img.source_url || img.url).hostname.replace("www.", "");
          } catch(e) {}
        }

        const sourceLabel = img.source ? img.source.replace("_", " ") : domain;
        const displayThumb = img.thumbnail || img.url;

        item.innerHTML = `
          <div class="image-thumb-wrap">
            <img src="${escapeHtml(displayThumb)}" alt="${escapeHtml(img.title || 'Image')}" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.image-card-box').style.display='none'" />
          </div>
          <div class="image-card-meta">
            <div class="image-card-title" title="${escapeHtml(img.title || 'Image')}">${escapeHtml(img.title || 'Image')}</div>
            <div class="image-card-source">
              <span class="dest-stat-pill" style="font-size: 0.68rem; text-transform: uppercase; padding: 2px 6px;">${escapeHtml(sourceLabel)}</span>
              <span>${escapeHtml(domain)}</span>
            </div>
          </div>
        `;

        item.addEventListener("click", () => {
          if (lightboxImg) lightboxImg.src = img.url;
          if (lightboxTitle) lightboxTitle.textContent = img.title || "Image Preview";
          if (lightboxDomain) lightboxDomain.textContent = domain;
          if (lightboxVisitBtn) {
            lightboxVisitBtn.href = img.source_url || img.url;
            lightboxVisitBtn.textContent = img.source_url ? "Visit Source Page ↗" : "View Source ↗";
          }
          if (lightboxRawImgBtn) {
            lightboxRawImgBtn.href = img.url;
          }
          if (lightboxModal) lightboxModal.classList.add("open");
        });
        imagesSection.appendChild(item);
      });
    } else {
      imagesSection.style.display = "none";
      const isErr = (data.status === "error" || Boolean(data.error));
      showEmptyState("images", query, isErr, data.message || data.error);
    }
  }

  // 6. Videos Category (Phase 7)
  function renderVideosCategory(data) {
    videosSection.style.display = "grid";
    videosSection.innerHTML = "";
    const videos = data.videos || [];
    if (videos.length > 0) {
      videos.forEach(v => {
        const card = document.createElement("a");
        card.className = "video-card-box";
        card.href = v.url;
        card.target = "_blank";
        card.rel = "noopener noreferrer";
        card.innerHTML = `
          <div class="video-thumb-container">
            <img src="${escapeHtml(v.thumbnail)}" alt="${escapeHtml(v.title)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=480&q=80'" />
            <div class="video-play-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
          </div>
          <div class="video-card-info">
            <div class="video-card-channel">${escapeHtml(v.channel || 'Video')}</div>
            <div class="video-card-title">${escapeHtml(v.title)}</div>
            ${v.snippet ? `<div class="video-card-snippet">${escapeHtml(v.snippet)}</div>` : ''}
          </div>
        `;
        videosSection.appendChild(card);
      });
    } else {
      emptyState.style.display = "block";
    }
  }

  // 7. Documents Category (Phase 8)
  function renderDocsCategory(data) {
    docsSection.style.display = "flex";
    docsSection.innerHTML = "";
    const docs = data.documents || [];
    if (docs.length > 0) {
      docs.forEach(doc => {
        const card = document.createElement("div");
        card.className = "doc-card-box";
        const isPdf = (doc.file_type || '').toUpperCase() === 'PDF' || (doc.url || '').toLowerCase().endsWith('.pdf');
        card.innerHTML = `
          <div class="doc-header-row">
            <span class="${isPdf ? 'doc-badge-pdf' : 'doc-badge-other'}">${isPdf ? 'PDF' : 'DOC'}</span>
            <span class="doc-domain-label">${escapeHtml(doc.domain || 'web')}</span>
          </div>
          <a href="${escapeHtml(doc.url)}" target="_blank" rel="noopener noreferrer" class="doc-title-link">${escapeHtml(doc.title)}</a>
          <p class="doc-snippet-text">${escapeHtml(doc.snippet)}</p>
          <div style="margin-top: 10px;">
            <a href="${escapeHtml(doc.url)}" target="_blank" rel="noopener noreferrer" style="font-size: 12px; font-weight: 600; color: var(--accent); text-decoration: none;">View Document ↗</a>
          </div>
        `;
        docsSection.appendChild(card);
      });
    } else {
      emptyState.style.display = "block";
    }
  }

  // 8. Developer / Code Category
  function renderCodeCategory(data) {
    codeSection.style.display = "flex";
    codeSection.innerHTML = "";
    const repos = data.repositories || [];
    if (repos.length > 0) {
      repos.forEach(repo => {
        const card = document.createElement("div");
        card.className = "code-card";
        card.innerHTML = `
          <div class="code-header-row">
            <a href="${escapeHtml(repo.url)}" target="_blank" rel="noopener noreferrer" class="code-title-link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:middle; margin-right:4px;"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              <span>${escapeHtml(repo.name)}</span>
            </a>
            <span class="dest-stat-pill" style="font-size:0.75rem;">GitHub</span>
          </div>
          <p class="code-desc">${escapeHtml(repo.description)}</p>
          <div class="code-meta-row">
            <span class="code-lang-pill">
              <span class="lang-color-dot"></span>
              ${escapeHtml(repo.language)}
            </span>
            <span class="code-stat-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle; margin-right:3px; opacity:0.8;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              ${Number(repo.stars).toLocaleString()}
            </span>
            <span class="code-stat-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:3px; opacity:0.8;"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"/><path d="M12 12v3"/></svg>
              ${Number(repo.forks).toLocaleString()}
            </span>
          </div>
        `;
        codeSection.appendChild(card);
      });
    }

    // Append web results for dev discussions
    if (data.web_results && data.web_results.length > 0) {
      data.web_results.forEach(item => {
        codeSection.appendChild(createWebResultCard(item));
      });
    } else if (repos.length === 0) {
      emptyState.style.display = "block";
    }
  }

  // 9. Shopping Category
  function renderShoppingCategory(data) {
    shoppingSection.style.display = "grid";
    shoppingSection.innerHTML = "";
    const products = data.products || [];
    if (products.length > 0) {
      products.forEach(p => {
        const card = document.createElement("div");
        card.className = "shop-card";
        const provLabel = p.source_provenance ? "Catalog Reference" : "Merchant Link";
        const provTitle = p.source_provenance || "Direct Merchant Link";
        card.innerHTML = `
          <div class="shop-merchant-row">
            <span class="shop-merchant-name">${escapeHtml(p.merchant || "Store")}</span>
            <span class="shop-rating-pill" style="font-size:0.7rem; color:var(--text-muted); border:1px solid var(--border-subtle); background:transparent;" title="${escapeHtml(provTitle)}">${escapeHtml(provLabel)}</span>
          </div>
          <div class="shop-title" title="${escapeHtml(p.title || "")}">${escapeHtml(p.title || "")}</div>
          <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:10px;">${escapeHtml((p.snippet || "").slice(0, 95))}...</p>
          <div class="shop-price-row">
            <span class="shop-price-tag" title="Reference Price">${escapeHtml(p.price || "Check Price")}</span>
            <a href="${escapeHtml(p.url || "#")}" target="_blank" rel="noopener noreferrer" class="shop-buy-btn">View Product ↗</a>
          </div>
        `;
        shoppingSection.appendChild(card);
      });
    } else {
      emptyState.style.display = "block";
    }
  }

  // 10. Jobs Category
  function renderJobsCategory(data) {
    jobsSection.style.display = "flex";
    jobsSection.innerHTML = "";
    const jobs = data.jobs || [];
    if (jobs.length > 0) {
      jobs.forEach(j => {
        const card = document.createElement("div");
        card.className = "job-card";
        card.innerHTML = `
          <div class="job-info-left">
            <div class="job-company-title">🏢 ${escapeHtml(j.company)}</div>
            <div class="job-role-title">${escapeHtml(j.title)}</div>
            <div class="job-meta-pills">
              <span class="job-pill">📍 ${escapeHtml(j.location)}</span>
              <span class="job-pill">💼 ${escapeHtml(j.type)}</span>
            </div>
          </div>
          <a href="${escapeHtml(j.url)}" target="_blank" rel="noopener noreferrer" class="job-apply-btn">Apply Now ↗</a>
        `;
        jobsSection.appendChild(card);
      });
    } else {
      emptyState.style.display = "block";
    }
  }

  // 11. Places / Maps Category
  function renderPlacesCategory(data) {
    if (data.destination) {
      populateDestinationCard(data.destination);
      destinationCard.style.display = "block";
    } else if (data.place || data.osm_url) {
      const place = data.place || {
        name: data.query || "Location",
        osm_url: data.osm_url,
        google_maps_url: data.google_maps_url,
        type: "Geographic / Location Discovery"
      };
      renderMapsOverviewCard(place);
    }
    if (data.results && data.results.length > 0) {
      webResultsSection.style.display = "flex";
      data.results.forEach(item => {
        webResultsSection.appendChild(createWebResultCard(item));
      });
    } else if (!data.destination && !data.place && !data.osm_url) {
      emptyState.style.display = "block";
    }
  }

  function renderMapsOverviewCard(place) {
    const card = document.createElement("div");
    card.className = "destination-card";
    card.style.display = "block";
    card.style.marginBottom = "20px";
    card.innerHTML = `
      <div class="dest-header">
        <div>
          <h2 class="dest-title" style="margin:0 0 4px 0; font-size:1.35rem;">📍 ${escapeHtml(place.name || "Location")}</h2>
          <div class="dest-country" style="color:var(--text-muted); font-size:0.85rem;">${escapeHtml(place.type || "Geographic / Map Discovery")}</div>
        </div>
      </div>
      <div style="margin: 12px 0; font-size: 0.88rem; line-height: 1.5; color: var(--text-secondary);">
        Explore interactive maps, verified location details, geographic coordinates, and official guides.
      </div>
      <div class="dest-actions-row" style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px;">
        ${place.osm_url ? `<a href="${escapeHtml(place.osm_url)}" target="_blank" rel="noopener noreferrer" class="hero-action-btn" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px;">🗺️ OpenStreetMap</a>` : ''}
        ${place.google_maps_url ? `<a href="${escapeHtml(place.google_maps_url)}" target="_blank" rel="noopener noreferrer" class="hero-action-btn" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px;">📍 Google Maps</a>` : ''}
      </div>
      <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 10px;">
        STAUNT Maps integrates verified OpenStreetMap geographic data and web directory sources.
      </div>
    `;
    webResultsSection.style.display = "flex";
    webResultsSection.appendChild(card);
  }

  // Helper: Web Result Card Creator
  function createWebResultCard(item) {
    const card = document.createElement("div");
    card.className = "result-card";

    let domainName = item.domain || "web";
    if (!domainName || domainName === "web") {
      try { domainName = new URL(item.url).hostname.replace("www.", ""); } catch(e) {}
    }
    const favicon = item.favicon || (domainName && domainName !== "web" ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domainName)}&sz=64` : '');
    const dateBadge = item.published_date ? `<span class="result-date-badge">${escapeHtml(item.published_date)}</span>` : '';

    card.innerHTML = `
      <div class="result-source-row">
        <div class="result-source-left">
          <div class="result-favicon-wrap">
            ${favicon ? `<img src="${escapeHtml(favicon)}" class="result-favicon" alt="" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline';" /><span class="result-favicon-fallback" style="display:none;">🌐</span>` : `<span class="result-favicon-fallback">🌐</span>`}
          </div>
          <div class="result-source-info">
            <span class="result-domain">${escapeHtml(domainName)}</span>
            <span class="result-breadcrumb">${escapeHtml(item.url || "")}</span>
          </div>
          ${dateBadge}
        </div>
        <div class="result-actions">
          <button type="button" class="copy-link-btn" title="Copy link" data-url="${escapeHtml(item.url)}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            <span class="copy-link-text">Copy</span>
          </button>
          <button type="button" class="reader-mode-btn" title="Ad-free Reader View">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <span>Reader</span>
          </button>
          <button type="button" class="save-bookmark-btn" title="Save to Collection">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span>Save</span>
          </button>
        </div>
      </div>
      <div class="result-title-wrap">
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="result-title">${escapeHtml(item.title)}</a>
      </div>
      <div class="result-body-row">
        <p class="result-snippet">${escapeHtml(item.snippet)}</p>
        ${item.thumbnail ? `
          <div class="result-thumb-wrap">
            <img src="${escapeHtml(item.thumbnail)}" class="result-thumb" alt="" loading="lazy" onerror="this.parentElement.style.display='none'" />
          </div>
        ` : ''}
      </div>
    `;

    // Copy Link Action
    const copyBtn = card.querySelector(".copy-link-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(item.url);
          const textSpan = copyBtn.querySelector(".copy-link-text");
          if (textSpan) {
            textSpan.textContent = "✓ Copied";
            setTimeout(() => { textSpan.textContent = "Copy"; }, 2000);
          }
        } catch (e) {
          const ta = document.createElement("textarea");
          ta.value = item.url;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          const textSpan = copyBtn.querySelector(".copy-link-text");
          if (textSpan) {
            textSpan.textContent = "✓ Copied";
            setTimeout(() => { textSpan.textContent = "Copy"; }, 2000);
          }
        }
      });
    }

    // Reader Mode Click
    card.querySelector(".reader-mode-btn").addEventListener("click", () => {
      openReaderMode(item.url, item.title, item.domain);
    });

    // Save Bookmark Click
    card.querySelector(".save-bookmark-btn").addEventListener("click", () => {
      openSaveModal(item);
    });

    return card;
  }

  // Helper: Destination Card Population
  function populateDestinationCard(dest) {
    if (!destinationCard) return;
    const images = (dest.images && dest.images.length > 0) ? dest.images : (dest.image ? [dest.image] : []);
    const destThumbsRow = document.getElementById("destThumbsRow");

    if (images.length > 0 && destHeroImg && destHeroImgWrap) {
      destHeroImg.src = images[0];
      destHeroImgWrap.style.display = "block";
      destHeroImg.onerror = () => { if (destHeroImgWrap) destHeroImgWrap.style.display = "none"; };

      if (destThumbsRow) {
        destThumbsRow.innerHTML = images.map((img, idx) => `
          <div class="dest-thumb-item ${idx === 0 ? 'active' : ''}" data-src="${escapeHtml(img)}">
            <img src="${escapeHtml(img)}" alt="Photo ${idx + 1}" referrerpolicy="no-referrer" />
          </div>
        `).join("");

        destThumbsRow.querySelectorAll(".dest-thumb-item").forEach(item => {
          item.addEventListener("click", () => {
            destThumbsRow.querySelectorAll(".dest-thumb-item").forEach(t => t.classList.remove("active"));
            item.classList.add("active");
            if (destHeroImg) destHeroImg.src = item.getAttribute("data-src");
          });
        });
      }
    } else if (destHeroImgWrap) {
      destHeroImgWrap.style.display = "none";
      if (destThumbsRow) destThumbsRow.innerHTML = "";
    }

    if (destTitle) destTitle.textContent = dest.name || "Destination";
    if (destCountry) destCountry.textContent = dest.country || "";
    if (destWeather) destWeather.textContent = dest.weather || "Mild";
    if (destTagline) destTagline.textContent = dest.tagline || "";
    if (destBestTime) destBestTime.textContent = `Best time: ${dest.best_time || 'All year'}`;
    if (destDuration) destDuration.textContent = `Recommended: ${dest.ideal_duration || '3-4 Days'}`;

    if (destAttractions) {
      destAttractions.innerHTML = (dest.attractions || []).map(att => `
        <button class="attraction-chip" data-attr="${escapeHtml(att)}">${escapeHtml(att)}</button>
      `).join("");

      destAttractions.querySelectorAll(".attraction-chip").forEach(chip => {
        chip.addEventListener("click", () => {
          const attr = chip.getAttribute("data-attr");
          if (headerInput) headerInput.value = `${dest.name} ${attr}`;
          executeSearch(`${dest.name} ${attr}`, "all");
        });
      });
    }

    if (destMapsBtn) destMapsBtn.href = dest.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest.name)}`;
    if (destHotelsBtn) destHotelsBtn.href = dest.hotels_url || `https://www.google.com/travel/hotels?q=hotels+in+${encodeURIComponent(dest.name)}`;
    if (destFlightsBtn) destFlightsBtn.href = dest.flights_url || `https://www.google.com/travel/flights?q=flights+to+${encodeURIComponent(dest.name)}`;
  }


  // Async AI Overview Fetcher
  async function fetchAiOverview(query, results) {
    try {
      const resp = await apiFetch("/api/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, results })
      });
      const data = await resp.json();
      if (data.status === "success" && data.data) {
        aiContent.innerHTML = formatMarkdown(data.data.overview);
        aiSources.innerHTML = (data.data.sources || []).map(s => `
          <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="source-chip" title="${escapeHtml(s.title)}">
            <span class="source-num">${s.index}</span>
            <span class="source-name">${escapeHtml(s.domain || "Source")}</span>
          </a>
        `).join("");
      } else {
        aiOverviewCard.style.display = "none";
      }
    } catch (e) {
      aiOverviewCard.style.display = "none";
    }
  }

  // Copy Overview Button
  safeOn(copyOverviewBtn, "click", () => {
    const text = aiContent.innerText;
    navigator.clipboard.writeText(text);
    copyOverviewBtn.innerHTML = `✓`;
    setTimeout(() => {
      copyOverviewBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="13" height="13" x="9" y="9" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    }, 2000);
  });

  // Render STAUNT Direct Answer Engine Card
  function renderDirectAnswerCard(ans, query) {
    if (!directAnswerCard) return;
    if (!ans || !ans.is_sufficient) {
      directAnswerCard.style.display = "none";
      return;
    }

    const answerBadge = document.getElementById("answerBadge");
    const answerConfidence = document.getElementById("answerConfidence");
    const answerContent = document.getElementById("answerContent");
    const answerBullets = document.getElementById("answerBullets");
    const answerSourcesSection = document.getElementById("answerSourcesSection");
    const answerSourcesChips = document.getElementById("answerSourcesChips");
    const answerFollowupSection = document.getElementById("answerFollowupSection");
    const answerFollowupChips = document.getElementById("answerFollowupChips");
    const answerProviderTag = document.getElementById("answerProviderTag");

    // Badge based on question_type
    const qType = ans.question_type || "general";
    let badgeText = "Direct Answer";
    if (qType === "comparison") badgeText = "Comparison";
    else if (qType === "explanation") badgeText = "Explanation";
    else if (qType === "current_info") badgeText = "Current Information";
    else if (qType === "hindi_hinglish") badgeText = "Direct Answer";
    else if (qType === "math_problem") badgeText = "Step-by-Step Solution";

    if (answerBadge) answerBadge.textContent = badgeText;
    if (answerConfidence) {
      answerConfidence.textContent = ans.confidence === "verified" ? "• Verified Sources" : "• Grounded in Web";
    }

    // Convert [1], [2] to clickable citation links
    function linkifyCitations(text) {
      if (!text) return "";
      return escapeHtml(text).replace(/\[(\d+)\]/g, (match, idx) => {
        const sIndex = parseInt(idx, 10);
        const source = (ans.sources || []).find(s => s.index === sIndex);
        if (source && source.url) {
          return `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer" class="answer-citation" title="${escapeHtml(source.title || source.domain || 'Source ' + idx)}">[${idx}]</a>`;
        }
        return `<span class="answer-citation">[${idx}]</span>`;
      });
    }

    if (answerContent) {
      answerContent.innerHTML = linkifyCitations(ans.direct_answer);
    }

    // Key points bullets
    if (answerBullets) {
      if (ans.key_points && ans.key_points.length > 0) {
        answerBullets.innerHTML = ans.key_points.map(pt => `
          <div class="answer-bullet-item">• ${linkifyCitations(pt)}</div>
        `).join("");
        answerBullets.style.display = "flex";
      } else {
        answerBullets.style.display = "none";
      }
    }

    // Sources chips
    if (answerSourcesSection && answerSourcesChips) {
      if (ans.sources && ans.sources.length > 0) {
        answerSourcesChips.innerHTML = ans.sources.map(s => `
          <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="answer-source-chip" title="${escapeHtml(s.title || s.url)}">
            <span class="chip-idx">[${s.index}]</span>
            <span class="chip-domain">${escapeHtml(s.domain || "Source")}</span>
          </a>
        `).join("");
        answerSourcesSection.style.display = "block";
      } else {
        answerSourcesSection.style.display = "none";
      }
    }

    // Follow-up related questions
    if (answerFollowupSection && answerFollowupChips) {
      if (ans.related_questions && ans.related_questions.length > 0) {
        answerFollowupChips.innerHTML = ans.related_questions.map(rq => `
          <button type="button" class="answer-followup-btn" data-query="${escapeHtml(rq)}">
            ${escapeHtml(rq)}
          </button>
        `).join("");
        answerFollowupSection.style.display = "block";

        answerFollowupChips.querySelectorAll(".answer-followup-btn").forEach(btn => {
          btn.addEventListener("click", () => {
            const nextQuery = btn.getAttribute("data-query");
            if (nextQuery) {
              if (searchInput) searchInput.value = nextQuery;
              executeSearch(nextQuery, "all");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          });
        });
      } else {
        answerFollowupSection.style.display = "none";
      }
    }

    // Footer provider info
    if (answerProviderTag) {
      answerProviderTag.textContent = ans.mode && ans.mode.startsWith("neural")
        ? "Synthesized by STAUNT AI · Grounded in sources"
        : "Extracted from verified public web sources";
    }

    directAnswerCard.style.display = "block";
  }

  // Copy Answer Button Handler
  const copyAnswerBtn = document.getElementById("copyAnswerBtn");
  safeOn(copyAnswerBtn, "click", () => {
    const textEl = document.getElementById("answerContent");
    const text = textEl ? textEl.innerText : "";
    if (navigator.clipboard && text) {
      navigator.clipboard.writeText(text);
      copyAnswerBtn.innerHTML = `✓`;
      setTimeout(() => {
        copyAnswerBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="13" height="13" x="9" y="9" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
      }, 2000);
    }
  });

  // Sidebar Related Queries
  async function updateRelatedQueries(query, data) {
    if (!relatedQueriesCard || !relatedQueriesList) return;

    // 1. Math / Calculation / Currency queries: suppress related queries completely
    if (data && (data.instant_answer || data.provider === "local_calculator" || data.provider === "live_currency_converter")) {
      relatedQueriesCard.style.display = "none";
      return;
    }

    const cleanQ = (query || "").trim();
    if (!cleanQ || cleanQ.length < 2) {
      relatedQueriesCard.style.display = "none";
      return;
    }

    // 2. Fetch genuine search suggestions from /api/suggest
    let suggestions = [];
    try {
      const resp = await apiFetch(`/api/suggest?q=${encodeURIComponent(cleanQ)}`);
      if (resp.ok) {
        const raw = await resp.json();
        const list = Array.isArray(raw) ? raw : (raw.suggestions || []);
        suggestions = list.filter(s => typeof s === "string" && s.trim().toLowerCase() !== cleanQ.toLowerCase());
      }
    } catch (e) {
      console.warn("Related queries suggest error:", e);
    }

    // 3. Fallback to entity / domain context if suggestions are empty
    if (suggestions.length === 0) {
      if (data && data.entity && data.entity.name) {
        suggestions.push(`${data.entity.name} profile`, `${data.entity.name} official`);
      }
    }

    if (suggestions.length === 0) {
      relatedQueriesCard.style.display = "none";
      return;
    }

    relatedQueriesCard.style.display = "block";
    relatedQueriesList.innerHTML = suggestions.slice(0, 6).map(q => `
      <div class="related-chip" data-q="${escapeHtml(q)}">${escapeHtml(q)}</div>
    `).join("");

    relatedQueriesList.querySelectorAll(".related-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const q = chip.getAttribute("data-q");
        if (headerInput) headerInput.value = q;
        executeSearch(q, activeTab);
      });
    });
  }

  // --- Reader Mode Logic ---
  async function openReaderMode(url, title, domain) {
    readerTitle.textContent = title || "Loading article...";
    readerDomainBadge.textContent = domain || "web";
    readerTimeBadge.textContent = "Estimating...";
    readerExternalLink.href = url;
    readerBody.innerHTML = `
      <div class="skeleton" style="height: 20px; width: 95%; margin-bottom: 12px;"></div>
      <div class="skeleton" style="height: 16px; width: 90%; margin-bottom: 8px;"></div>
      <div class="skeleton" style="height: 16px; width: 98%; margin-bottom: 8px;"></div>
      <div class="skeleton" style="height: 16px; width: 85%;"></div>
    `;
    readerModal.classList.add("open");

    try {
      const resp = await apiFetch(`/api/reader?url=${encodeURIComponent(url)}`);
      const data = await resp.json();
      readerTitle.textContent = data.title || title;
      readerDomainBadge.textContent = data.domain || domain;
      readerTimeBadge.textContent = data.reading_time || "2 min read";
      readerBody.innerHTML = data.content_html || "<p>Could not extract readable article.</p>";
    } catch (e) {
      readerBody.innerHTML = `<p>Failed to load reader view. Please open the page directly.</p>`;
    }
  }

  safeOn(closeReaderBtn, "click", () => readerModal.classList.remove("open"));
  safeOn(readerFontInc, "click", () => {
    currentReaderFontSize = Math.min(1.6, currentReaderFontSize + 0.1);
    readerBody.style.fontSize = `${currentReaderFontSize}rem`;
  });
  safeOn(readerFontDec, "click", () => {
    currentReaderFontSize = Math.max(0.9, currentReaderFontSize - 0.1);
    readerBody.style.fontSize = `${currentReaderFontSize}rem`;
  });

  // Lightbox Close
  safeOn(closeLightboxBtn, "click", () => lightboxModal.classList.remove("open"));

  // Empty State Actions
  safeOn(emptySwitchAllBtn, "click", () => {
    const q = (headerInput && headerInput.value.trim()) || (homeInput && homeInput.value.trim()) || currentSearchQuery;
    if (q) {
      executeSearch(q, "all");
    }
  });

  safeOn(emptyRetryBtn, "click", () => {
    const q = (headerInput && headerInput.value.trim()) || (homeInput && homeInput.value.trim()) || currentSearchQuery;
    if (q) {
      executeSearch(q, activeTab || "all");
    }
  });

  // Close modals on overlay click
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("open");
      }
    });
  });

  // --- USER AUTHENTICATION & DASHBOARD ---

  // Check auth state on launch
  async function checkAuth() {
    try {
      const resp = await apiFetch("/api/auth/me");
      const data = await resp.json();
      if (data.authenticated && data.user) {
        currentUser = data.user;
        updateUserUI(true);
        loadCollections();
      } else {
        currentUser = null;
        updateUserUI(false);
      }
    } catch (e) {
      currentUser = null;
      updateUserUI(false);
    }
  }

  function updateUserUI(isLoggedIn) {
    if (isLoggedIn && currentUser) {
      const name = currentUser.name || currentUser.email.split("@")[0];
      if (userAuthText) userAuthText.textContent = name;
      if (dashAvatar) dashAvatar.textContent = name.charAt(0).toUpperCase();
      if (dashUserName) dashUserName.textContent = name;
      if (dashUserEmail) dashUserEmail.textContent = currentUser.email;
    } else {
      if (userAuthText) userAuthText.textContent = "Sign In";
      if (dashUserName) dashUserName.textContent = "Guest User";
      if (dashUserEmail) dashUserEmail.textContent = "Sign in to sync your search hub";
    }
  }

  safeOn(userAuthBtn, "click", () => {
    if (currentUser) {
      openDashboard();
    } else {
      authModal.classList.add("open");
    }
  });

  safeOn(dashboardBtn, "click", openDashboard);

  function openDashboard() {
    if (!currentUser) {
      authModal.classList.add("open");
      return;
    }
    dashboardModal.classList.add("open");
    loadCollections();
    loadHistory();
    loadSavedBookmarks();
    loadPreferences();
  }

  safeOn(closeAuthModal, "click", () => authModal.classList.remove("open"));
  safeOn(closeDashboardModal, "click", () => dashboardModal.classList.remove("open"));

  // Tab switching between Sign In & Register
  let isRegisterMode = false;
  safeOn(tabSignIn, "click", () => {
    isRegisterMode = false;
    tabSignIn.classList.add("active");
    tabRegister.classList.remove("active");
    nameGroup.style.display = "none";
    authSubmitBtn.textContent = "Sign In";
    authErrorMsg.style.display = "none";
  });
  safeOn(tabRegister, "click", () => {
    isRegisterMode = true;
    tabRegister.classList.add("active");
    tabSignIn.classList.remove("active");
    nameGroup.style.display = "flex";
    authSubmitBtn.textContent = "Create Account";
    authErrorMsg.style.display = "none";
  });

  safeOn(authForm, "submit", async (e) => {
    e.preventDefault();
    authErrorMsg.style.display = "none";
    const email = authEmail.value.trim();
    const password = authPassword.value.trim();
    const name = authName.value.trim();

    const endpoint = isRegisterMode ? "/api/auth/register" : "/api/auth/login";
    const payload = isRegisterMode ? { email, password, name } : { email, password };

    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (resp.ok && data.user) {
        currentUser = data.user;
        updateUserUI(true);
        authModal.classList.remove("open");
        loadCollections();
      } else {
        authErrorMsg.textContent = data.error || "Authentication failed.";
        authErrorMsg.style.display = "block";
      }
    } catch (err) {
      authErrorMsg.textContent = "Network error. Please try again.";
      authErrorMsg.style.display = "block";
    }
  });

  safeOn(signOutBtn, "click", async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    currentUser = null;
    updateUserUI(false);
    dashboardModal.classList.remove("open");
  });

  // Dashboard Tab Switching
  dashTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      dashTabs.forEach(t => t.classList.remove("active"));
      dashPanes.forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      const view = tab.getAttribute("data-view");
      const targetPane = document.getElementById(`pane${view.charAt(0).toUpperCase() + view.slice(1)}`);
      if (targetPane) targetPane.classList.add("active");
    });
  });

  // --- Collections Management ---
  async function loadCollections() {
    if (!currentUser) return;
    try {
      const resp = await apiFetch("/api/collections");
      const data = await resp.json();
      userCollections = data.collections || [];

      // Update collections grid
      collectionsGrid.innerHTML = userCollections.map(c => `
        <div class="coll-item-card" data-name="${escapeHtml(c.name)}">
          <div class="coll-item-title">📁 ${escapeHtml(c.name)}</div>
          <div class="coll-item-desc">${escapeHtml(c.description || 'Collection')}</div>
        </div>
      `).join("");

      // Update save modal dropdown
      saveCollectionSelect.innerHTML = userCollections.map(c => `
        <option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>
      `).join("");

      // Update filter select in Saved Bookmarks
      savedFilterSelect.innerHTML = `<option value="">All Collections</option>` + userCollections.map(c => `
        <option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>
      `).join("");

    } catch (e) {
      console.warn("Could not load collections:", e);
    }
  }

  safeOn(newCollectionBtn, "click", async () => {
    const name = prompt("Enter new collection name (e.g., AI Research, Stays, Physics):");
    if (!name || !name.trim()) return;
    try {
      const resp = await apiFetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: "Personal collection" })
      });
      if (resp.ok) {
        loadCollections();
      }
    } catch (e) {
      alert("Failed to create collection");
    }
  });

  // --- Search History Management ---
  async function loadHistory() {
    if (!currentUser) return;
    try {
      const resp = await apiFetch("/api/history?limit=40");
      const data = await resp.json();
      const items = data.history || [];

      if (items.length === 0) {
        historyList.innerHTML = `<p style="font-size:0.85rem; color:var(--text-secondary); padding: 14px;">No search history recorded.</p>`;
        return;
      }

      historyList.innerHTML = items.map(h => `
        <div class="history-row-item">
          <span class="history-query-text" data-q="${escapeHtml(h.query)}" data-cat="${escapeHtml(h.category)}">
            ${escapeHtml(h.query)}
          </span>
          <div class="history-meta">
            <span class="history-cat-badge">${escapeHtml(h.category)}</span>
            <button class="delete-item-btn" data-id="${h.id}" title="Delete query">✕</button>
          </div>
        </div>
      `).join("");

      historyList.querySelectorAll(".history-query-text").forEach(el => {
        el.addEventListener("click", () => {
          const q = el.getAttribute("data-q");
          const cat = el.getAttribute("data-cat") || "all";
          dashboardModal.classList.remove("open");
          executeSearch(q, cat);
        });
      });

      historyList.querySelectorAll(".delete-item-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-id");
          await apiFetch(`/api/history/${id}`, { method: "DELETE" });
          loadHistory();
        });
      });

    } catch (e) {
      console.warn("Could not load history:", e);
    }
  }

  safeOn(clearHistoryBtn, "click", async () => {
    if (confirm("Are you sure you want to clear your entire search history?")) {
      await apiFetch("/api/history/clear", { method: "POST" });
      loadHistory();
    }
  });

  safeOn(toggleHistoryBtn, "click", async () => {
    const resp = await apiFetch("/api/history/toggle", { method: "POST" });
    const data = await resp.json();
    toggleHistoryBtn.textContent = data.history_enabled ? "Pause History" : "Resume History";
  });

  // --- Saved Bookmarks Management ---
  async function loadSavedBookmarks(collection = "") {
    if (!currentUser) return;
    try {
      const url = collection ? `/api/saved?collection=${encodeURIComponent(collection)}` : "/api/saved";
      const resp = await fetch(url);
      const data = await resp.json();
      const saved = data.saved || [];

      if (saved.length === 0) {
        savedResultsList.innerHTML = `<p style="font-size:0.85rem; color:var(--text-secondary); padding: 14px;">No saved bookmarks in this collection.</p>`;
        return;
      }

      savedResultsList.innerHTML = saved.map(item => `
        <div class="saved-row-item">
          <div>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" style="font-weight:600; font-size:0.92rem;">
              ${escapeHtml(item.title)}
            </a>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
              📁 ${escapeHtml(item.collection_name)} • ${escapeHtml(item.domain)}
            </div>
          </div>
          <button class="delete-item-btn" data-id="${item.id}" title="Remove bookmark">✕</button>
        </div>
      `).join("");

      savedResultsList.querySelectorAll(".delete-item-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-id");
          await apiFetch(`/api/saved/${id}`, { method: "DELETE" });
          loadSavedBookmarks(savedFilterSelect.value);
        });
      });

    } catch (e) {
      console.warn("Could not load saved bookmarks:", e);
    }
  }

  safeOn(savedFilterSelect, "change", () => {
    loadSavedBookmarks(savedFilterSelect.value);
  });

  // Save Modal
  function openSaveModal(item) {
    if (!currentUser) {
      authModal.classList.add("open");
      return;
    }
    pendingSaveItem = item;
    saveItemTitle.textContent = item.title;
    saveResultModal.classList.add("open");
  }

  safeOn(closeSaveResultModal, "click", () => saveResultModal.classList.remove("open"));

  safeOn(confirmSaveBtn, "click", async () => {
    if (!pendingSaveItem) return;
    const selectedCollection = saveCollectionSelect.value || "General";
    try {
      const resp = await apiFetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pendingSaveItem.title,
          url: pendingSaveItem.url,
          domain: pendingSaveItem.domain,
          snippet: pendingSaveItem.snippet,
          category: activeTab,
          collection_name: selectedCollection
        })
      });
      if (resp.ok) {
        saveResultModal.classList.remove("open");
        alert(`Saved to ${selectedCollection}!`);
      }
    } catch (e) {
      alert("Failed to save bookmark.");
    }
  });

  // --- Preferences Management ---
  async function loadPreferences() {
    if (!currentUser) return;
    try {
      const resp = await apiFetch("/api/preferences");
      const data = await resp.json();
      const p = data.preferences || {};
      prefSafeSearch.value = p.safe_search || "moderate";
      prefNewTab.checked = p.open_new_tab !== false;
      prefHistoryEnabled.checked = p.history_enabled !== false;
      prefPersonalized.checked = !!p.personalized;
    } catch (e) {}
  }

  function savePreferences() {
    if (!currentUser) return;
    const payload = {
      safe_search: prefSafeSearch.value,
      open_new_tab: prefNewTab.checked,
      history_enabled: prefHistoryEnabled.checked,
      personalized: prefPersonalized.checked
    };
    apiFetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  safeOn(prefSafeSearch, "change", savePreferences);
  safeOn(prefNewTab, "change", savePreferences);
  safeOn(prefHistoryEnabled, "change", savePreferences);
  safeOn(prefPersonalized, "change", savePreferences);

  // Export User Data
  safeOn(exportDataBtn, "click", async () => {
    try {
      const resp = await apiFetch("/api/export");
      const data = await resp.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vastuda-data-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to export data");
    }
  });

  // --- Helper Functions ---
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatMarkdown(text) {
    if (!text) return "";
    let html = escapeHtml(text);
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Italic
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    // Lists
    html = html.replace(/^\s*[-•]\s+(.*)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");
    // Paragraphs
    html = html.split("\n\n").map(p => p.startsWith("<ul>") ? p : `<p>${p}</p>`).join("");
    return html;
  }

  // --- Initial URL Query Param Check (e.g. ?q=World+Tech+news+today) ---
  function checkUrlParams(isPopState = false) {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const cat = params.get("category") || "all";
    const page = parseInt(params.get("page") || "1", 10) || 1;
    const time = params.get("time") || "";
    if (q && q.trim()) {
      homeInput.value = q.trim();
      headerInput.value = q.trim();
      tabBtns.forEach(btn => {
        if (btn.getAttribute("data-tab") === cat) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
      executeSearch(q.trim(), cat, time, page, isPopState);
    } else {
      // Cleanly reset back to homeView when navigating back with browser button
      returnToHome(false);
    }
  }

  window.addEventListener("popstate", () => {
    checkUrlParams(true);
  });

  // --- BING-STYLE DYNAMIC WALLPAPERS ---
  const WALLPAPERS = [
    {
      url: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1920&q=80",
      location: "Santorini, Aegean Sea, Greece"
    },
    {
      url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1920&q=80",
      location: "Yosemite Valley, California"
    },
    {
      url: "https://images.unsplash.com/photo-1513584684374-8bab748fbf90?auto=format&fit=crop&w=1920&q=80",
      location: "Kyoto Autumn Lanterns, Japan"
    },
    {
      url: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1920&q=80",
      location: "Cinque Terre Coastline, Italy"
    },
    {
      url: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1920&q=80",
      location: "Taj Mahal Sunrise, Agra, India"
    },
    {
      url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80",
      location: "Tropical Coastline, Maldives"
    }
  ];

  // ==========================================================================
  // STAUNT DESKTOP WEB SEARCH ENGINE — MODULE IMPLEMENTATION
  // ==========================================================================

  // --- 1. DYNAMIC WALLPAPER SYSTEM WITH RESILIENT CROSSFADE ---
  const DEFAULT_WALLPAPERS = [
    {
      id: "himachal",
      title: "Himachal Pradesh, India",
      location: "Himachal Pradesh, India",
      url: "/static/wallpapers/himachal.svg",
      fallback_url: "/static/wallpapers/himachal.svg"
    },
    {
      id: "varanasi",
      title: "Varanasi Ghats at Dusk",
      location: "Varanasi, Uttar Pradesh",
      url: "/static/wallpapers/varanasi.svg",
      fallback_url: "/static/wallpapers/varanasi.svg"
    },
    {
      id: "coastal",
      title: "Coastal Sunset & Arabian Sea",
      location: "Coastal India",
      url: "/static/wallpapers/coastal.svg",
      fallback_url: "/static/wallpapers/coastal.svg"
    },
    {
      id: "teagardens",
      title: "Emerald Tea Gardens of Munnar",
      location: "Tea Gardens, Munnar",
      url: "/static/wallpapers/teagardens.svg",
      fallback_url: "/static/wallpapers/teagardens.svg"
    },
    {
      id: "desert",
      title: "Thar Desert Golden Dunes",
      location: "Desert India, Rajasthan",
      url: "/static/wallpapers/desert.svg",
      fallback_url: "/static/wallpapers/desert.svg"
    },
    {
      id: "modern",
      title: "Modern India Tech Skyline",
      location: "Modern India",
      url: "/static/wallpapers/modern.svg",
      fallback_url: "/static/wallpapers/modern.svg"
    },
    {
      id: "dal_lake",
      title: "Kashmir Dal Lake Reflections",
      location: "Dal Lake, Kashmir",
      url: "/static/wallpapers/dal_lake.svg",
      fallback_url: "/static/wallpapers/dal_lake.svg"
    }
  ];

  // --- 1. STAUNT 6 PHOTOREALISTIC LANDSCAPE WALLPAPERS ---
  const STAUNT_WALLPAPERS = [
    { key: "wp_alpine_sunrise", title: "Alpine Sunrise", url: "/static/wallpapers/wp_alpine_sunrise.webp", thumb: "/static/wallpapers/wp_alpine_sunrise_thumb.webp" },
    { key: "wp_cosmic_horizon", title: "Cosmic Horizon", url: "/static/wallpapers/wp_cosmic_horizon.webp", thumb: "/static/wallpapers/wp_cosmic_horizon_thumb.webp" },
    { key: "wp_neo_city", title: "Neo City", url: "/static/wallpapers/wp_neo_city.webp", thumb: "/static/wallpapers/wp_neo_city_thumb.webp" },
    { key: "wp_hidden_forest", title: "Hidden Forest", url: "/static/wallpapers/wp_hidden_forest.webp", thumb: "/static/wallpapers/wp_hidden_forest_thumb.webp" },
    { key: "wp_deep_ocean", title: "Deep Ocean", url: "/static/wallpapers/wp_deep_ocean.webp", thumb: "/static/wallpapers/wp_deep_ocean_thumb.webp" },
    { key: "wp_moonlit_dunes", title: "Moonlit Dunes", url: "/static/wallpapers/wp_moonlit_dunes.webp", thumb: "/static/wallpapers/wp_moonlit_dunes_thumb.webp" }
  ];

  function setStauntWallpaper(wpKey) {
    const found = STAUNT_WALLPAPERS.find(w => w.key === wpKey) || STAUNT_WALLPAPERS[0];
    document.documentElement.style.setProperty("--staunt-wallpaper-url", `url('${found.url}')`);
    document.documentElement.setAttribute("data-wallpaper", found.key);
    try {
      localStorage.setItem("staunt_wallpaper", found.key);
    } catch (e) {}

    // Synchronize active state in Settings grid
    document.querySelectorAll(".wp-select-card").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-wp") === found.key);
    });
  }

  function initWallpaperManager() {
    // Initial wallpaper load from persistent localStorage or default
    const saved = localStorage.getItem("staunt_wallpaper") || "wp_alpine_sunrise";
    setStauntWallpaper(saved);

    // Settings wallpaper grid interaction
    const grid = document.getElementById("wallpaperSelectorGrid");
    if (grid) {
      grid.addEventListener("click", (e) => {
        const card = e.target.closest(".wp-select-card");
        if (!card) return;
        const key = card.getAttribute("data-wp");
        if (key) {
          setStauntWallpaper(key);
        }
      });
    }
  }

  // --- LOCATION PERMISSION & SYSTEM ---
  function initLocationSystem() {
    const footerLoc = document.getElementById("footerLocation");
    const footerLocText = document.getElementById("footerLocationText");
    const footerFlagIcon = document.getElementById("footerFlagIcon");
    const homeLocPill = document.getElementById("homeLocationPill");
    const homeLocName = document.getElementById("homeLocationName");

    const INDIA_FLAG_SVG = `<svg class="flag-svg" width="18" height="12" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
      <path fill="#FF9933" d="M0 0h640v160H0z"/>
      <path fill="#FFFFFF" d="M0 160h640v160H0z"/>
      <path fill="#128807" d="M0 320h640v160H0z"/>
      <circle cx="320" cy="240" r="38" fill="none" stroke="#000080" stroke-width="7"/>
      <circle cx="320" cy="240" r="8" fill="#000080"/>
      <g stroke="#000080" stroke-width="2.5">
        <line x1="320" y1="202" x2="320" y2="278"/><line x1="282" y1="240" x2="358" y2="240"/>
        <line x1="293" y1="213" x2="347" y2="267"/><line x1="293" y1="267" x2="347" y2="213"/>
        <line x1="305" y1="204" x2="335" y2="276"/><line x1="335" y1="204" x2="305" y2="276"/>
        <line x1="284" y1="225" x2="356" y2="255"/><line x1="284" y1="255" x2="356" y2="225"/>
      </g>
    </svg>`;

    function getCountryFlag(countryCode, countryName) {
      const code = (countryCode || "").toLowerCase();
      const name = (countryName || "").toLowerCase();
      if (!code || code === "in" || name.includes("india")) {
        return INDIA_FLAG_SVG;
      }
      if (code.length === 2) {
        const offset = 127397;
        const chars = [...code.toUpperCase()].map(c => String.fromCodePoint(c.charCodeAt(0) + offset));
        return `<span class="flag-emoji" style="font-size: 15px; line-height: 1;">${chars.join('')}</span>`;
      }
      return INDIA_FLAG_SVG;
    }

    function updateLocUI(label, countryCode, countryName) {
      if (homeLocName) {
        homeLocName.textContent = label;
      }
      if (footerLocText) {
        footerLocText.textContent = label;
      } else if (footerLoc) {
        footerLoc.textContent = label;
      }
      if (footerFlagIcon) {
        footerFlagIcon.innerHTML = getCountryFlag(countryCode, countryName || label);
      }
    }

    const savedLoc = localStorage.getItem("staunt_user_location");
    const savedCode = localStorage.getItem("staunt_user_country_code");
    if (savedLoc) {
      updateLocUI(savedLoc, savedCode);
    } else {
      updateLocUI("India", "in", "India");
    }

    function requestLocation() {
      if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser. Defaulting to India.");
        return;
      }
      if (homeLocName) homeLocName.textContent = "Locating…";
      if (footerLocText) {
        footerLocText.textContent = "Locating…";
      } else if (footerLoc) {
        footerLoc.textContent = "Locating…";
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
            if (resp.ok) {
              const data = await resp.json();
              const city = data.address?.city || data.address?.town || data.address?.county || data.address?.state || "India";
              const country = data.address?.country || "India";
              const countryCode = data.address?.country_code || "in";
              const label = `${city}, ${country}`;
              localStorage.setItem("staunt_user_location", label);
              localStorage.setItem("staunt_user_country_code", countryCode);
              updateLocUI(label, countryCode, country);
              return;
            }
          } catch (e) {}
          updateLocUI("India", "in", "India");
        },
        (err) => {
          console.warn("Geolocation permission not granted or unavailable:", err.message);
          updateLocUI("India", "in", "India");
          localStorage.removeItem("staunt_user_location");
          localStorage.removeItem("staunt_user_country_code");
        },
        { timeout: 7000, maximumAge: 60000 }
      );
    }

    if (homeLocPill) {
      homeLocPill.addEventListener("click", requestLocation);
    }
    if (footerLoc) {
      footerLoc.addEventListener("click", requestLocation);
      footerLoc.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          requestLocation();
        }
      });
    }
  }

  // --- 2. CUSTOMIZABLE SHORTCUTS GRID ---
  const DEFAULT_SHORTCUTS = [
    { name: "YouTube", url: "https://www.youtube.com", icon: "https://www.google.com/s2/favicons?domain=youtube.com&sz=64" },
    { name: "Google", url: "https://www.google.com", icon: "https://www.google.com/s2/favicons?domain=google.com&sz=64" },
    { name: "Wikipedia", url: "https://www.wikipedia.org", icon: "https://www.google.com/s2/favicons?domain=wikipedia.org&sz=64" },
    { name: "GitHub", url: "https://www.github.com", icon: "https://www.google.com/s2/favicons?domain=github.com&sz=64" },
    { name: "Gmail", url: "https://mail.google.com", icon: "https://www.google.com/s2/favicons?domain=mail.google.com&sz=64" },
    { name: "Maps", url: "https://maps.google.com", icon: "https://www.google.com/s2/favicons?domain=maps.google.com&sz=64" },
    { name: "Amazon", url: "https://www.amazon.in", icon: "https://www.google.com/s2/favicons?domain=amazon.in&sz=64" },
    { name: "Flipkart", url: "https://www.flipkart.com", icon: "https://www.google.com/s2/favicons?domain=flipkart.com&sz=64" }
  ];

  let userShortcuts = [];

  function initShortcutsManager() {
    const grid = document.getElementById("shortcutsGrid");
    const shortcutModal = document.getElementById("shortcutModal");
    const closeShortcutModal = document.getElementById("closeShortcutModal");
    const cancelShortcutBtn = document.getElementById("cancelShortcutBtn");
    const shortcutForm = document.getElementById("shortcutForm");
    const nameInput = document.getElementById("shortcutNameInput");
    const urlInput = document.getElementById("shortcutUrlInput");

    // Load from localStorage
    try {
      const stored = localStorage.getItem("staunt_shortcuts_v2");
      if (stored) {
        userShortcuts = JSON.parse(stored);
      }
    } catch (e) {
      userShortcuts = [];
    }

    if (!userShortcuts || userShortcuts.length === 0) {
      userShortcuts = [...DEFAULT_SHORTCUTS];
      saveShortcuts();
    }

    renderShortcutsGrid();

    // Add Shortcut Modal Handlers
    function openAddModal() {
      if (shortcutModal) {
        if (nameInput) nameInput.value = "";
        if (urlInput) urlInput.value = "https://";
        shortcutModal.classList.add("open");
        setTimeout(() => urlInput && urlInput.focus(), 100);
      }
    }

    function closeModal() {
      if (shortcutModal) shortcutModal.classList.remove("open");
    }

    if (closeShortcutModal) closeShortcutModal.addEventListener("click", closeModal);
    if (cancelShortcutBtn) cancelShortcutBtn.addEventListener("click", closeModal);

    if (shortcutForm) {
      shortcutForm.addEventListener("submit", (e) => {
        e.preventDefault();
        let rawUrl = (urlInput.value || "").trim();
        let rawName = (nameInput.value || "").trim();

        if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
          rawUrl = "https://" + rawUrl;
        }

        try {
          const u = new URL(rawUrl);
          if (!rawName) rawName = u.hostname.replace("www.", "").split(".")[0];
          const icon = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;

          userShortcuts.push({
            name: rawName,
            url: u.href,
            icon: icon
          });

          saveShortcuts();
          renderShortcutsGrid();
          closeModal();
        } catch (err) {
          alert("Please enter a valid website URL (e.g. https://example.com)");
        }
      });
    }

    // Attach to global window for reset
    window.resetShortcutsToDefault = () => {
      userShortcuts = [...DEFAULT_SHORTCUTS];
      saveShortcuts();
      renderShortcutsGrid();
    };
  }

  function saveShortcuts() {
    try {
      localStorage.setItem("staunt_shortcuts_v2", JSON.stringify(userShortcuts));
    } catch (e) {}
  }

  function renderShortcutsGrid() {
    const grid = document.getElementById("shortcutsGrid");
    if (!grid) return;

    grid.innerHTML = "";

    userShortcuts.forEach((item, index) => {
      const tile = document.createElement("a");
      tile.href = item.url;
      tile.target = "_blank";
      tile.rel = "noopener noreferrer";
      tile.className = "shortcut-tile";
      tile.title = `${item.name} (${item.url})`;

      tile.innerHTML = `
        <div class="shortcut-icon-box">
          <img src="${escapeHtml(item.icon)}" alt="${escapeHtml(item.name)}" onerror="this.src='/static/icons/icon.svg'" />
        </div>
        <span class="shortcut-name">${escapeHtml(item.name)}</span>
        <button type="button" class="shortcut-action-del" title="Remove Shortcut" data-idx="${index}">✕</button>
      `;

      // Prevent tile navigation when delete button clicked
      const delBtn = tile.querySelector(".shortcut-action-del");
      delBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        userShortcuts.splice(index, 1);
        saveShortcuts();
        renderShortcutsGrid();
      });

      grid.appendChild(tile);
    });

    // Add Shortcut Tile
    const addTile = document.createElement("div");
    addTile.className = "shortcut-tile add-shortcut-tile";
    addTile.title = "Add custom shortcut";
    addTile.innerHTML = `
      <div class="shortcut-icon-box" style="border-style: dashed; font-size: 22px; color: var(--accent);">
        +
      </div>
      <span class="shortcut-name">Add shortcut</span>
    `;
    addTile.addEventListener("click", () => {
      const shortcutModal = document.getElementById("shortcutModal");
      const nameInput = document.getElementById("shortcutNameInput");
      const urlInput = document.getElementById("shortcutUrlInput");
      if (nameInput) nameInput.value = "";
      if (urlInput) urlInput.value = "https://";
      if (shortcutModal) shortcutModal.classList.add("open");
    });
    grid.appendChild(addTile);
  }

  // --- 3. LIVE WEATHER WIDGET & HOURLY FORECAST ---
  async function initWeatherWidget() {
    const topWeatherCity = document.getElementById("topWeatherCity");
    const topWeatherIcon = document.getElementById("topWeatherIcon");
    const topWeatherTemp = document.getElementById("topWeatherTemp");
    const topWeatherPill = document.getElementById("topWeatherPill");

    const weatherCardCity = document.getElementById("weatherCardCity");
    const weatherUpdatedTime = document.getElementById("weatherUpdatedTime");
    const weatherMainIcon = document.getElementById("weatherMainIcon");
    const weatherMainTemp = document.getElementById("weatherMainTemp");
    const weatherMainCond = document.getElementById("weatherMainCond");
    const weatherHigh = document.getElementById("weatherHigh");
    const weatherLow = document.getElementById("weatherLow");
    const weatherFeelsLike = document.getElementById("weatherFeelsLike");
    const weatherAqi = document.getElementById("weatherAqi");
    const weatherAqiStatus = document.getElementById("weatherAqiStatus");
    const weatherHourlyStrip = document.getElementById("weatherHourlyStrip");
    const weatherRefreshBtn = document.getElementById("weatherRefreshBtn");

    async function loadWeather() {
      try {
        const res = await apiFetch("/api/weather");
        if (res && res.ok) {
          const data = await res.json();
          const city = data.city || "Delhi, India";
          const temp = `${data.temp}°C`;
          const cond = data.condition || "Haze";
          const icon = data.icon || "⛅";

          if (topWeatherCity) topWeatherCity.textContent = city;
          if (topWeatherIcon) topWeatherIcon.textContent = icon;
          if (topWeatherTemp) topWeatherTemp.textContent = `${temp} ${cond}`;

          if (weatherCardCity) weatherCardCity.textContent = city;
          if (weatherMainIcon) weatherMainIcon.textContent = icon;
          if (weatherMainTemp) weatherMainTemp.textContent = temp;
          if (weatherMainCond) weatherMainCond.textContent = cond;

          if (weatherHigh) weatherHigh.textContent = `${data.high || 32}°`;
          if (weatherLow) weatherLow.textContent = `${data.low || 24}°`;
          if (weatherFeelsLike) weatherFeelsLike.textContent = `${data.feels_like || 30}°`;
          if (weatherAqi) weatherAqi.textContent = data.aqi || 176;
          if (weatherAqiStatus) weatherAqiStatus.textContent = data.aqi_status || "Moderate";
          if (weatherUpdatedTime) weatherUpdatedTime.textContent = `Updated ${data.updated_at || 'just now'}`;

          // Render Hourly Forecast (6 Slots)
          if (weatherHourlyStrip && Array.isArray(data.hourly) && data.hourly.length > 0) {
            weatherHourlyStrip.innerHTML = data.hourly.slice(0, 6).map(h => `
              <div class="hourly-slot">
                <span>${escapeHtml(h.time)}</span>
                <span style="font-size: 1.1rem;">${h.icon}</span>
                <span class="hourly-temp">${escapeHtml(h.temp)}°</span>
              </div>
            `).join("");
          }
        }
      } catch (e) {
        console.warn("Weather widget load notice:", e);
      }
    }

    loadWeather();

    if (weatherRefreshBtn) weatherRefreshBtn.addEventListener("click", loadWeather);

    if (topWeatherPill) {
      topWeatherPill.addEventListener("click", () => {
        const city = topWeatherCity ? topWeatherCity.textContent : "Delhi";
        homeInput.value = `weather in ${city}`;
        headerInput.value = `weather in ${city}`;
        executeSearch(`weather in ${city}`, "all");
      });
    }
  }

  // --- 4. TRENDING SEARCHES & FINANCIAL MARKETS ---
  async function initTrendingAndMarkets() {
    const trendingList = document.getElementById("trendingList");
    const trendingRefreshBtn = document.getElementById("trendingRefreshBtn");
    const marketsList = document.getElementById("marketsList");
    const marketsRefreshBtn = document.getElementById("marketsRefreshBtn");

    async function loadTrending() {
      try {
        const res = await apiFetch("/api/trending");
        if (!res || !res.ok) return;
        const data = await res.json();

        // 1. Trending Searches (Ranked 1-10 with green arrows)
        if (trendingList && Array.isArray(data.topics)) {
          trendingList.innerHTML = data.topics.map((t, idx) => {
            const rank = t.rank || (idx + 1);
            return `
              <div class="trend-item-row" data-query="${escapeHtml(t.query)}">
                <span class="trend-rank">${rank}</span>
                <span class="trend-query">${escapeHtml(t.query)}</span>
                <span class="trend-arrow">↗</span>
              </div>
            `;
          }).join("");

          trendingList.querySelectorAll(".trend-item-row").forEach(row => {
            row.addEventListener("click", () => {
              const q = row.getAttribute("data-query");
              homeInput.value = q;
              headerInput.value = q;
              executeSearch(q, "all");
            });
          });
        }

        // 2. Financial Markets (Sensex, Nifty 50, Gold 24K)
        if (marketsList && Array.isArray(data.markets)) {
          marketsList.innerHTML = data.markets.slice(0, 3).map(m => `
            <div class="market-index-row" data-query="${escapeHtml(m.symbol)} today price index">
              <span class="market-sym-name">${escapeHtml(m.symbol)}</span>
              <div class="market-val-group">
                <span class="market-val-num">${escapeHtml(m.value)}</span>
                <span class="market-change-badge ${m.is_up ? 'up' : 'down'}">${escapeHtml(m.change)} ↗</span>
                <svg class="market-sparkline-svg" viewBox="0 0 120 30" fill="none">
                  <path d="${m.sparkline || 'M0,25 Q40,15 80,18 T120,5'}" stroke="${m.is_up ? '#10b981' : '#ef4444'}" stroke-width="2.5" stroke-linecap="round"/>
                </svg>
              </div>
            </div>
          `).join("");

          marketsList.querySelectorAll(".market-index-row").forEach(row => {
            row.addEventListener("click", () => {
              const q = row.getAttribute("data-query");
              homeInput.value = q;
              headerInput.value = q;
              executeSearch(q, "all");
            });
          });
        }
      } catch (e) {
        console.warn("Trending and markets fetch notice:", e);
      }
    }

    loadTrending();

    if (trendingRefreshBtn) trendingRefreshBtn.addEventListener("click", loadTrending);
    if (marketsRefreshBtn) marketsRefreshBtn.addEventListener("click", loadTrending);
  }

  // --- 5. TODAY'S HIGHLIGHTS & EXPLORE TOPICS ---
  async function initHighlightsAndTopics() {
    const highlightsGrid = document.getElementById("highlightsGrid");
    const hlTabs = document.querySelectorAll(".hl-tab-btn");
    const exploreScroll = document.getElementById("exploreTopicsScroll");
    const explorePrevBtn = document.getElementById("explorePrevBtn");
    const exploreNextBtn = document.getElementById("exploreNextBtn");

    async function loadHighlights(cat = "trending") {
      if (!highlightsGrid) return;
      highlightsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--text-muted);">
          Loading ${cat} headlines...
        </div>
      `;

      try {
        const res = await apiFetch(`/api/discover?category=${encodeURIComponent(cat)}`);
        if (res && res.ok) {
          const data = await res.json();
          const items = data.items || [];
          if (items.length === 0) {
            renderFallbackHighlights(cat);
            return;
          }

          highlightsGrid.innerHTML = items.slice(0, 3).map((n, i) => {
            const thumb = n.image || `/static/wallpapers/${DEFAULT_WALLPAPERS[i % DEFAULT_WALLPAPERS.length].id}.svg`;
            const badge = cat === "trending" ? "News" : cat.toUpperCase();
            return `
              <a href="${escapeHtml(n.url || '#')}" target="_blank" rel="noopener noreferrer" class="highlight-item-card">
                <div class="hl-img-wrap">
                  <img src="${escapeHtml(thumb)}" alt="${escapeHtml(n.title)}" class="hl-img" onerror="this.src='/static/wallpapers/himachal.svg'" />
                  <span class="hl-badge">${escapeHtml(badge)}</span>
                </div>
                <div class="hl-body">
                  <div class="hl-title">${escapeHtml(n.title)}</div>
                  <div class="hl-snippet">${escapeHtml(n.snippet || '')}</div>
                  <div class="hl-footer">
                    <span>${escapeHtml(n.domain || n.source || 'Verified Source')}</span>
                    <span>${escapeHtml(n.published_date || 'Recent')}</span>
                  </div>
                </div>
              </a>
            `;
          }).join("");
          return;
        }
      } catch (e) {
        console.warn("Highlights load notice:", e);
      }

      renderFallbackHighlights(cat);
    }

    function renderFallbackHighlights(cat) {
      if (!highlightsGrid) return;
      const defaults = [
        {
          title: "ISRO successfully launches new Earth observation satellite",
          snippet: "The mission aims to enhance climate monitoring, disaster management and geospatial data for India.",
          source: "The Hindu",
          badge: "Science",
          time: "2 hours ago",
          url: "https://www.thehindu.com",
          img: "/static/wallpapers/himachal.svg"
        },
        {
          title: "New citizen services and schemes on India.gov.in",
          snippet: "Explore the latest government services, schemes and initiatives for citizens across India.",
          source: "PIB",
          badge: "Government",
          time: "4 hours ago",
          url: "https://india.gov.in",
          img: "/static/wallpapers/varanasi.svg"
        },
        {
          title: "India's AI and digital initiatives gain momentum",
          snippet: "National AI mission expands compute infrastructure and indigenous research partnerships.",
          source: "Mint",
          badge: "Technology",
          time: "6 hours ago",
          url: "https://www.livemint.com",
          img: "/static/wallpapers/modern.svg"
        }
      ];

      highlightsGrid.innerHTML = defaults.map(d => `
        <a href="${d.url}" target="_blank" rel="noopener noreferrer" class="highlight-item-card">
          <div class="hl-img-wrap">
            <img src="${d.img}" alt="${d.title}" class="hl-img" />
            <span class="hl-badge">${d.badge}</span>
          </div>
          <div class="hl-body">
            <div class="hl-title">${d.title}</div>
            <div class="hl-snippet">${d.snippet}</div>
            <div class="hl-footer">
              <span>${d.source}</span>
              <span>${d.time}</span>
            </div>
          </div>
        </a>
      `).join("");
    }

    loadHighlights("trending");

    hlTabs.forEach(btn => {
      btn.addEventListener("click", () => {
        hlTabs.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const cat = btn.getAttribute("data-cat") || "trending";
        loadHighlights(cat);
      });
    });

    // Horizontal scroll for Explore Topics strip with state tracking
    function updateExploreNavState() {
      if (!explorePrevBtn || !exploreNextBtn || !exploreScroll) return;
      const atStart = exploreScroll.scrollLeft <= 5;
      const atEnd = exploreScroll.scrollLeft + exploreScroll.clientWidth >= exploreScroll.scrollWidth - 5;
      explorePrevBtn.disabled = atStart;
      exploreNextBtn.disabled = atEnd;
      explorePrevBtn.style.opacity = atStart ? "0.35" : "1";
      const nextBtnStyle = atEnd ? "0.35" : "1";
      exploreNextBtn.style.opacity = nextBtnStyle;
      explorePrevBtn.style.pointerEvents = atStart ? "none" : "auto";
      exploreNextBtn.style.pointerEvents = atEnd ? "none" : "auto";
    }

    if (explorePrevBtn && exploreScroll) {
      explorePrevBtn.addEventListener("click", () => {
        exploreScroll.scrollBy({ left: -220, behavior: "smooth" });
        setTimeout(updateExploreNavState, 350);
      });
    }

    if (exploreNextBtn && exploreScroll) {
      exploreNextBtn.addEventListener("click", () => {
        exploreScroll.scrollBy({ left: 220, behavior: "smooth" });
        setTimeout(updateExploreNavState, 350);
      });
    }

    if (exploreScroll) {
      exploreScroll.addEventListener("scroll", updateExploreNavState, { passive: true });
      updateExploreNavState();
    }
  }

  // --- 6. NAVIGATION RAIL, TOP CATEGORIES & CLOCK ---
  function initNavigationRailAndHeader() {
    const navRail = document.getElementById("navRail");
    const toggleBtn = document.getElementById("navRailToggleBtn");
    const topClockTime = document.getElementById("topClockTime");
    const topClockDate = document.getElementById("topClockDate");

    // Hamburger toggle
    if (toggleBtn && navRail) {
      toggleBtn.addEventListener("click", () => {
        if (window.innerWidth <= 900) {
          navRail.classList.toggle("open");
        } else {
          navRail.classList.toggle("collapsed");
        }
      });
    }

    // Rail navigation items
    document.querySelectorAll(".rail-item").forEach(item => {
      item.addEventListener("click", () => {
        const query = item.getAttribute("data-query");
        const action = item.getAttribute("data-action");
        const tab = item.getAttribute("data-tab");

        document.querySelectorAll(".rail-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");

        if (action === "discover") {
          window.location.href = "/discover";
          return;
        }

        if (item.id === "navBookmarks") {
          const saveModal = document.getElementById("saveResultModal");
          if (saveModal) saveModal.classList.add("open");
          return;
        }

        if (item.id === "navSettings") {
          const settingsModal = document.getElementById("settingsModal");
          if (settingsModal) settingsModal.classList.add("open");
          return;
        }

        if (item.id === "navHome") {
          returnToHome(true);
          return;
        }

        if (query) {
          homeInput.value = query;
          headerInput.value = query;
          executeSearch(query, "all");
        } else if (tab) {
          activeTab = tab;
          if (currentQuery) {
            executeSearch(currentQuery, tab);
          }
        }
      });
    });

    // Top categories bar
    document.querySelectorAll(".top-cat-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        if (!tab) return;
        document.querySelectorAll(".top-cat-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        activeTab = tab;
        const q = (currentQuery || homeInput.value).trim();
        if (q) {
          executeSearch(q, tab);
        } else {
          // Switch tab in results view
          switchTab(tab);
        }
      });
    });

    // Dropdown items
    document.querySelectorAll(".dropdown-item").forEach(item => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const tab = item.getAttribute("data-tab");
        const q = (currentQuery || homeInput.value || "India").trim();
        if (tab === "books") window.open(`https://books.google.com/books?q=${encodeURIComponent(q)}`, "_blank");
        else if (tab === "finance") window.open(`https://www.google.com/finance/quote/${encodeURIComponent(q)}`, "_blank");
        else if (tab === "flights") window.open(`https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`, "_blank");
        else if (tab === "scholar") window.open(`https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`, "_blank");
      });
    });

    // Live clock update
    function updateClock() {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;

      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const dayName = days[now.getDay()];
      const monthName = months[now.getMonth()];
      const dateNum = now.getDate();
      const year = now.getFullYear();

      if (topClockTime) topClockTime.textContent = `${hours}:${minutes} ${ampm}`;
      if (topClockDate) topClockDate.textContent = `${dayName}, ${dateNum} ${monthName} ${year}`;
    }

    updateClock();
    setInterval(updateClock, 1000);
  }

  // --- 7. QUICK TOOLS (8 Tools in 4x2 Grid) ---
  function initQuickTools() {
    const qrModal = document.getElementById("qrModal");
    const closeQrModal = document.getElementById("closeQrModal");
    const qrTextInput = document.getElementById("qrTextInput");
    const qrImg = document.getElementById("qrImg");

    if (closeQrModal && qrModal) {
      closeQrModal.addEventListener("click", () => qrModal.classList.remove("open"));
    }

    if (qrTextInput && qrImg) {
      qrTextInput.addEventListener("input", () => {
        const text = encodeURIComponent(qrTextInput.value || "https://staunt.vercel.app");
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${text}`;
      });
    }

    document.querySelectorAll(".tool-tile").forEach(tile => {
      tile.addEventListener("click", (e) => {
        const tool = tile.getAttribute("data-tool");
        if (!tool) return;

        if (tool === "translate") {
          const q = (currentQuery || homeInput.value).trim();
          if (q) {
            executeSearch(`translate ${q} to english`, "all");
          } else {
            window.open("https://translate.google.com", "_blank");
          }
        } else if (tool === "calculator") {
          homeInput.value = "120 * 45";
          headerInput.value = "120 * 45";
          executeSearch("120 * 45", "all");
        } else if (tool === "unit_convert") {
          homeInput.value = "100 km to miles";
          headerInput.value = "100 km to miles";
          executeSearch("100 km to miles", "all");
        } else if (tool === "currency") {
          homeInput.value = "100 USD to INR";
          headerInput.value = "100 USD to INR";
          executeSearch("100 USD to INR", "all");
        } else if (tool === "qr_code") {
          if (qrModal) qrModal.classList.add("open");
        } else if (tool === "screenshot") {
          alert("Press 'Windows + Shift + S' to take a quick screenshot!");
        } else if (tool === "image_search") {
          switchTab("images");
          homeInput.focus();
        }
      });
    });
  }

  // --- 8. SETTINGS MODAL & PREFERENCES ---
  function initSettingsModal() {
    const settingsModal = document.getElementById("settingsModal");
    const closeSettingsModal = document.getElementById("closeSettingsModal");
    const settingsBtn = document.getElementById("settingsBtn");

    const settingAutoWallpaper = document.getElementById("settingAutoWallpaper");
    const settingWallpaperInterval = document.getElementById("settingWallpaperInterval");
    const settingReducedMotion = document.getElementById("settingReducedMotion");
    const settingSafeSearch = document.getElementById("settingSafeSearch");
    const settingNewTab = document.getElementById("settingNewTab");
    const resetShortcutsBtn = document.getElementById("resetShortcutsBtn");
    const clearHistoryBtn = document.getElementById("clearHistoryBtn");

    if (settingsBtn && settingsModal) {
      settingsBtn.addEventListener("click", () => settingsModal.classList.add("open"));
    }

    if (closeSettingsModal && settingsModal) {
      closeSettingsModal.addEventListener("click", () => settingsModal.classList.remove("open"));
    }

    // Auto Wallpaper
    if (settingAutoWallpaper) {
      settingAutoWallpaper.checked = isWpRotating;
      settingAutoWallpaper.addEventListener("change", () => {
        isWpRotating = settingAutoWallpaper.checked;
        localStorage.setItem("staunt_auto_wallpaper", isWpRotating ? "true" : "false");
        if (isWpRotating) startWallpaperRotation();
        else stopWallpaperRotation();
      });
    }

    // Interval Select
    if (settingWallpaperInterval) {
      settingWallpaperInterval.value = String(wpIntervalMs / 1000);
      settingWallpaperInterval.addEventListener("change", () => {
        const sec = parseInt(settingWallpaperInterval.value, 10);
        localStorage.setItem("staunt_wallpaper_interval", String(sec));
        if (sec > 0) {
          wpIntervalMs = sec * 1000;
          isWpRotating = true;
          startWallpaperRotation();
        } else {
          isWpRotating = false;
          stopWallpaperRotation();
        }
      });
    }

    // Reduced Motion
    if (settingReducedMotion) {
      settingReducedMotion.addEventListener("change", () => {
        if (settingReducedMotion.checked) {
          document.body.classList.add("reduced-motion");
          localStorage.setItem("staunt_reduced_motion", "true");
        } else {
          document.body.classList.remove("reduced-motion");
          localStorage.setItem("staunt_reduced_motion", "false");
        }
      });
    }

    // Reset Shortcuts
    if (resetShortcutsBtn) {
      resetShortcutsBtn.addEventListener("click", () => {
        if (window.resetShortcutsToDefault) {
          window.resetShortcutsToDefault();
          alert("Shortcuts reset to default!");
        }
      });
    }

    // Clear History
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener("click", () => {
        localStorage.removeItem("staunt_search_history");
        alert("Search history cleared!");
      });
    }
  }

  // --- 9. VOICE & VISUAL SEARCH CONTROLS ---
  function initVoiceAndVisualSearch() {
    const voiceBtn = document.getElementById("homeVoiceBtn");
    const visualBtn = document.getElementById("homeVisualBtn");

    if (voiceBtn) {
      voiceBtn.addEventListener("click", () => {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
          alert("Voice search is not supported by your current browser. You can type directly in the search box.");
          return;
        }

        try {
          const recognition = new SpeechRec();
          recognition.lang = "en-IN";
          recognition.interimResults = false;

          homeInput.placeholder = "Listening... Speak now";
          voiceBtn.style.color = "#ef4444";

          recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            homeInput.value = transcript;
            headerInput.value = transcript;
            executeSearch(transcript, "all");
          };

          recognition.onerror = () => {
            homeInput.placeholder = "Search the web with STAUNT...";
            voiceBtn.style.color = "";
          };

          recognition.onend = () => {
            homeInput.placeholder = "Search the web with STAUNT...";
            voiceBtn.style.color = "";
          };

          recognition.start();
        } catch (err) {
          console.warn("Speech recognition notice:", err);
        }
      });
    }

    // Combined Visual Search Controller
    const visualModal = document.getElementById("visualSearchModal");
    const closeVisualModalBtn = document.getElementById("closeVisualModalBtn");
    const discVisualCard = document.getElementById("discVisualCard");
    const fileInput = document.getElementById("homeVisualFileInput");
    const dropzone = document.getElementById("visualDropzone");
    const browseText = document.getElementById("visualBrowseText");
    const urlForm = document.getElementById("visualUrlForm");
    const urlInput = document.getElementById("visualUrlInput");
    const cameraPanel = document.getElementById("visualCameraPanel");
    const camStartBtn = document.getElementById("visualCamStartBtn");
    const camSnapBtn = document.getElementById("visualCamSnapBtn");
    const camVideo = document.getElementById("visualCameraVideo");
    const camCanvas = document.getElementById("visualCameraCanvas");
    let activeStream = null;

    function openVisualModal() {
      if (visualModal) {
        visualModal.style.display = "flex";
        document.body.classList.add("modal-open");
        // Check camera support conditionally
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && cameraPanel) {
          cameraPanel.style.display = "block";
        }
      }
    }

    function closeVisualModal() {
      if (visualModal) visualModal.style.display = "none";
      document.body.classList.remove("modal-open");
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
        activeStream = null;
      }
      if (camVideo) camVideo.style.display = "none";
      if (camSnapBtn) camSnapBtn.style.display = "none";
      if (camStartBtn) camStartBtn.style.display = "inline-flex";
    }

    function handleSelectedFile(file) {
      if (!file) return;
      const cleanName = (file.name || "image")
        .replace(/\.[^/.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim();
      const q = cleanName || "image search";
      closeVisualModal();
      if (homeInput) homeInput.value = q;
      if (headerInput) headerInput.value = q;
      executeSearch(q, "images");
    }

    if (visualBtn) visualBtn.addEventListener("click", openVisualModal);
    if (discVisualCard) discVisualCard.addEventListener("click", openVisualModal);
    if (closeVisualModalBtn) closeVisualModalBtn.addEventListener("click", closeVisualModal);
    if (visualModal) {
      visualModal.addEventListener("click", (e) => {
        if (e.target === visualModal) closeVisualModal();
      });
    }
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && visualModal && visualModal.style.display === "flex") {
        closeVisualModal();
      }
    });

    if (browseText && fileInput) {
      browseText.addEventListener("click", (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }
    if (dropzone && fileInput) {
      dropzone.addEventListener("click", () => fileInput.click());
      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("drag-over");
      });
      dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("drag-over");
      });
      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("drag-over");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleSelectedFile(e.dataTransfer.files[0]);
        }
      });
    }
    if (fileInput) {
      fileInput.addEventListener("change", () => {
        if (fileInput.files && fileInput.files[0]) {
          handleSelectedFile(fileInput.files[0]);
        }
      });
    }

    if (urlForm && urlInput) {
      urlForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const u = urlInput.value.trim();
        if (u) {
          closeVisualModal();
          if (homeInput) homeInput.value = u;
          if (headerInput) headerInput.value = u;
          executeSearch(u, "images");
        }
      });
    }

    // Camera capture if supported
    if (camStartBtn && camVideo && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      camStartBtn.addEventListener("click", async () => {
        try {
          activeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          camVideo.srcObject = activeStream;
          camVideo.style.display = "block";
          camStartBtn.style.display = "none";
          if (camSnapBtn) camSnapBtn.style.display = "inline-flex";
        } catch (err) {
          console.warn("Camera access denied or unavailable:", err);
          alert("Camera access was not granted or is unavailable. Please select an image file instead.");
        }
      });
    }

    if (camSnapBtn && camCanvas && camVideo) {
      camSnapBtn.addEventListener("click", () => {
        try {
          camCanvas.width = camVideo.videoWidth || 640;
          camCanvas.height = camVideo.videoHeight || 480;
          const ctx = camCanvas.getContext("2d");
          ctx.drawImage(camVideo, 0, 0, camCanvas.width, camCanvas.height);
          closeVisualModal();
          const q = "camera visual snapshot";
          if (homeInput) homeInput.value = q;
          if (headerInput) headerInput.value = q;
          executeSearch(q, "images");
        } catch (err) {
          closeVisualModal();
        }
      });
    }
  }

  // --- 10. HERO SEARCH ACTIONS ("STAUNT Search" & "I'm Feeling Lucky") ---
  function initHeroSearchActions() {
    const homeSearchBtn = document.getElementById("homeSearchBtn");
    const homeLuckyBtn = document.getElementById("homeLuckyBtn");

    if (homeSearchBtn) {
      homeSearchBtn.addEventListener("click", () => {
        const q = (homeInput ? homeInput.value : "").trim();
        if (q) {
          if (headerInput) headerInput.value = q;
          executeSearch(q, "all");
        } else if (homeInput) {
          homeInput.focus();
        }
      });
    }

    if (homeLuckyBtn) {
      const LUCKY_TOPICS = [
        "ISRO latest missions",
        "Who was Albert Einstein?",
        "Why is the sky blue?",
        "Explain photosynthesis",
        "CA vs CMA",
        "What is quantum computing?",
        "India technology roadmap 2026",
        "Taj Mahal history and architecture"
      ];
      homeLuckyBtn.addEventListener("click", () => {
        let q = (homeInput ? homeInput.value : "").trim();
        if (!q) {
          q = LUCKY_TOPICS[Math.floor(Math.random() * LUCKY_TOPICS.length)];
          if (homeInput) homeInput.value = q;
        }
        if (headerInput) headerInput.value = q;
        executeSearch(q, "all");
      });
    }
  }

  // --- 11. SEARCH CHIPS CAROUSEL (Left/Right Scroll Controls) ---
  function initChipsCarousel() {
    const chipsRow = document.getElementById("searchChipsRow");
    const prevBtn = document.getElementById("chipsNavPrev");
    const nextBtn = document.getElementById("chipsNavNext");
    if (!chipsRow) return;

    function updateNavState() {
      if (!prevBtn || !nextBtn) return;
      const atStart = chipsRow.scrollLeft <= 4;
      const atEnd = chipsRow.scrollLeft + chipsRow.clientWidth >= chipsRow.scrollWidth - 4;
      prevBtn.disabled = atStart;
      nextBtn.disabled = atEnd;
      prevBtn.style.opacity = atStart ? "0.3" : "1";
      nextBtn.style.opacity = atEnd ? "0.3" : "1";
      prevBtn.style.pointerEvents = atStart ? "none" : "auto";
      nextBtn.style.pointerEvents = atEnd ? "none" : "auto";
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        chipsRow.scrollBy({ left: -220, behavior: "smooth" });
        setTimeout(updateNavState, 350);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        chipsRow.scrollBy({ left: 220, behavior: "smooth" });
        setTimeout(updateNavState, 350);
      });
    }

    chipsRow.addEventListener("scroll", updateNavState, { passive: true });
    window.addEventListener("resize", updateNavState);
    updateNavState();
  }

  // --- 12. KEYBOARD NAVIGATION (ArrowLeft / ArrowRight) ---
  function initKeyboardNavigation() {
    window.addEventListener("keydown", (e) => {
      // 1. Never intercept when user is typing inside any input, textarea, select, or contenteditable
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.tagName === "SELECT" ||
        activeEl.isContentEditable
      )) {
        return;
      }

      // 2. Never block native browser shortcuts like Alt+Left (Back) or Alt+Right (Forward)
      if (e.altKey || e.ctrlKey || e.metaKey) {
        return;
      }

      if (e.key === "ArrowLeft") {
        if (document.body.classList.contains("in-search-mode")) {
          if (prevPageBtn && !prevPageBtn.disabled && prevPageBtn.offsetParent !== null) {
            e.preventDefault();
            prevPageBtn.click();
          }
        } else {
          const chipsPrev = document.getElementById("chipsNavPrev");
          const chipsRow = document.getElementById("searchChipsRow");
          const prevWpBtn = document.getElementById("prevWallpaperBtn");
          if (chipsRow && chipsRow.scrollLeft > 5 && chipsPrev && !chipsPrev.disabled) {
            e.preventDefault();
            chipsPrev.click();
          } else if (prevWpBtn) {
            e.preventDefault();
            prevWpBtn.click();
          }
        }
      } else if (e.key === "ArrowRight") {
        if (document.body.classList.contains("in-search-mode")) {
          if (nextPageBtn && !nextPageBtn.disabled && nextPageBtn.offsetParent !== null) {
            e.preventDefault();
            nextPageBtn.click();
          }
        } else {
          const chipsNext = document.getElementById("chipsNavNext");
          const chipsRow = document.getElementById("searchChipsRow");
          const nextWpBtn = document.getElementById("nextWallpaperBtn");
          if (chipsRow && chipsRow.scrollLeft + chipsRow.clientWidth < chipsRow.scrollWidth - 5 && chipsNext && !chipsNext.disabled) {
            e.preventDefault();
            chipsNext.click();
          } else if (nextWpBtn) {
            e.preventDefault();
            nextWpBtn.click();
          }
        }
      }
    });
  }

  // Initializations
  initWallpaperManager();
  initLocationSystem();
  initShortcutsManager();
  initWeatherWidget();
  initTrendingAndMarkets();
  initHighlightsAndTopics();
  initNavigationRailAndHeader();
  initQuickTools();
  initSettingsModal();
  initVoiceAndVisualSearch();
  initHeroSearchActions();
  initChipsCarousel();
  initKeyboardNavigation();

  // Initial Auth & URL Check
  checkAuth();
  checkUrlParams();
});


