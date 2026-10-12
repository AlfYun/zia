  const FOLDER_DEFAULT_COLOR = "white";

  const FOLDER_COLORS = [
    ["white", "#fbfbfb"],
    ["green", "#008b5d"],
    ["blue", "#007fbd"],
    ["purple", "#625da5"],
    ["amber", "#c98400"],
    ["pink", "#bd556b"],
    ["red", "#cc4a55"],
    ["orange", "#c95125"],
  ];

  const FOLDER_COLOR_PREF = "zia.folder-colors";

  function readFolderColors() {
    try {
      return JSON.parse(Services.prefs.getStringPref(FOLDER_COLOR_PREF, "{}")) || {};
    } catch (err) {
      return {};
    }
  }

  function writeFolderColors(map) {
    try {
      Services.prefs.setStringPref(FOLDER_COLOR_PREF, JSON.stringify(map));
    } catch (err) {
      console.error("[Zia] Could not save the folder colours:", err);
    }
  }

  function folderColorOf(value) {
    if (!value) {
      return null;
    }
    if (typeof value === "string") {
      return value;
    }
    return value.color || null;
  }

  function isPresetFolderColor(color) {
    return FOLDER_COLORS.some(([name]) => name === color);
  }

  // "#abc" or "#aabbcc", normalised to a lowercase 6-digit hex (or null)
  function normalizedFolderHex(text) {
    const hex = String(text ?? "").trim().replace(/^#/, "").match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
    if (!hex) {
      return null;
    }
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
    return "#" + full.toLowerCase();
  }

  function paintFolder(folder, value) {
    if (!folder) {
      return;
    }
    const color = folderColorOf(value);
    if (color && !isPresetFolderColor(color)) {
      const hex = normalizedFolderHex(color);
      setAttr(folder, "zia-folder-color", hex ? "custom" : null);
      setStyle(folder, "--zia-folder-custom-swatch", hex);
      return;
    }
    setAttr(folder, "zia-folder-color", color || null);
    setStyle(folder, "--zia-folder-custom-swatch", null);
  }

  function setFolderColor(folder, color) {
    if (!folder?.id) {
      return;
    }
    const map = readFolderColors();
    if (color) {
      map[folder.id] = color;
    } else {
      delete map[folder.id];
    }
    writeFolderColors(map);
    paintFolder(folder, color);
  }

  function restoreFolderColors() {
    const map = readFolderColors();
    for (const folder of document.querySelectorAll("zen-folder")) {
      if (map[folder.id]) {
        paintFolder(folder, map[folder.id]);
      }
    }
  }

  function folderFromNode(node) {
    if (!node) {
      return null;
    }
    if (gBrowser.isTabGroupLabel?.(node)) {
      return node.group;
    }
    if (gBrowser.isTabGroupLabel?.(node.parentElement)) {
      return node.parentElement.group;
    }
    if (node.parentElement?.isZenFolder && node.classList?.contains("tab-group-label-container")) {
      return node.parentElement;
    }
    return node.closest?.("zen-folder") || null;
  }

  function colorDotIcon(hex) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="${hex}"/></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  function customDotIcon() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5f6d"/><stop offset="0.5" stop-color="#7f7fd5"/><stop offset="1" stop-color="#00c9ff"/></linearGradient></defs><circle cx="8" cy="8" r="7" fill="url(#g)"/></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  function closeCustomColorPanel() {
    document.getElementById("zia-folder-custom-color-panel")?.remove();
  }

  // A small popup (23-folder-colours.js, panel styled in 06) with a hex
  // field, anchored to the folder whose "Custom…" item was picked
  function openCustomColorPanel(folder) {
    closeCustomColorPanel();
    if (!folder) {
      return;
    }
    const anchor = folder.querySelector(":scope > .tab-group-label-container") || folder;

    const panel = document.createXULElement("panel");
    panel.id = "zia-folder-custom-color-panel";
    panel.setAttribute("type", "arrow");
    panel.setAttribute("consumeoutsideclicks", "true");
    panel.setAttribute("noautofocus", "false");

    const box = document.createElementNS(XHTML_NS, "div");
    box.className = "zia-folder-custom-color-box";
    const input = document.createElementNS(XHTML_NS, "input");
    input.setAttribute("type", "text");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("placeholder", "#hex");
    input.setAttribute("maxlength", "7");
    const current = folder.getAttribute("zia-folder-color") === "custom"
      ? normalizedFolderHex(getComputedStyle(folder).getPropertyValue("--zia-folder-custom-swatch"))
      : null;
    input.value = current || "";
    box.appendChild(input);
    panel.appendChild(box);
    document.documentElement.appendChild(panel);

    panel.addEventListener("popupshown", () => {
      input.focus();
      input.select();
    });
    panel.addEventListener("popuphidden", () => panel.remove(), { once: true });

    input.addEventListener("input", () => {
      input.toggleAttribute("invalid", !!input.value.trim() && !normalizedFolderHex(input.value));
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const hex = normalizedFolderHex(input.value);
        if (hex) {
          setFolderColor(folder, hex);
          panel.hidePopup();
        }
      } else if (event.key === "Escape") {
        panel.hidePopup();
      }
    });

    panel.openPopup(anchor, "bottomleft topleft", 0, 4, false, false);
  }

  function buildFolderColorMenu() {
    const submenu = document.createXULElement("menu");
    submenu.id = "zia-folder-color-menu";
    submenu.setAttribute("label", "Folder Color");
    const popup = document.createXULElement("menupopup");
    for (const [name, hex] of FOLDER_COLORS) {
      const item = document.createXULElement("menuitem");
      item.className = "menuitem-iconic";
      item.setAttribute("type", "radio");
      item.setAttribute("name", "zia-folder-color");
      item.setAttribute("label", name[0].toUpperCase() + name.slice(1));
      item.setAttribute("image", colorDotIcon(hex));
      item.setAttribute("zia-color", name);
      item.addEventListener("command", () => {
        const folder = submenu.ziaFolder;
        const same = folder?.getAttribute("zia-folder-color") === name;
        const clear = name === FOLDER_DEFAULT_COLOR || same;
        setFolderColor(folder, clear ? null : name);
      });
      popup.appendChild(item);
    }

    popup.appendChild(document.createXULElement("menuseparator"));
    const custom = document.createXULElement("menuitem");
    custom.id = "zia-folder-color-custom";
    custom.className = "menuitem-iconic";
    custom.setAttribute("type", "radio");
    custom.setAttribute("name", "zia-folder-color");
    custom.setAttribute("label", "Custom…");
    custom.setAttribute("image", customDotIcon());
    custom.addEventListener("command", () => openCustomColorPanel(submenu.ziaFolder));
    popup.appendChild(custom);

    submenu.appendChild(popup);
    return submenu;
  }

  function addFolderColorPicker() {
    let submenu = null;
    document.addEventListener(
      "popupshowing",
      (event) => {
        const menu = event.target;
        if (menu?.id !== "zenFolderActions") {
          return;
        }

        const trigger = menu.triggerNode || event.explicitOriginalTarget;
        const folder = folderFromNode(trigger);
        if (!folder?.isZenFolder) {
          if (submenu) {
            submenu.hidden = true;
          }
          return;
        }

        if (!submenu) {
          submenu = buildFolderColorMenu();
          const rename = document.getElementById("context_zenFolderRename");
          if (rename?.parentElement === menu) {
            menu.insertBefore(submenu, rename);
          } else {
            menu.appendChild(submenu);
          }
        }

        submenu.hidden = false;
        submenu.ziaFolder = folder;
        const current = folder.getAttribute("zia-folder-color") || FOLDER_DEFAULT_COLOR;
        for (const item of submenu.querySelector("menupopup").children) {
          const isCustomItem = item.id === "zia-folder-color-custom";
          item.toggleAttribute("checked", isCustomItem ? current === "custom" : item.getAttribute("zia-color") === current);
        }
      },
      true
    );
  }

  function watchFolderColors() {
    restoreFolderColors();
    setTimeout(restoreFolderColors, 1500);
    gBrowser.tabContainer.addEventListener("TabGroupCreate", (event) => {
      const saved = readFolderColors()[event.target?.id];
      if (saved) {
        paintFolder(event.target, saved);
      }
    });
  }

  const GROUP_COLOR_TOKEN = /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]*\)|#[0-9a-f]{3,8}\b/i;

  // Advanced Tab Groups' picker colours are gradients, which color-mix can't take: the group gets the first stop
  function paintGroupSwatch(group) {
    if (group?.localName !== "tab-group" || group.hasAttribute("split-view-group")) {
      return;
    }
    const color = getComputedStyle(group).getPropertyValue("--tab-group-color").trim();
    const stop = color.includes("gradient") ? color.match(GROUP_COLOR_TOKEN)?.[0] : null;
    const swatch = stop ? `rgb(from ${stop} r g b)` : "";
    if (group.style.getPropertyValue("--zia-group-swatch") === swatch) {
      return;
    }
    setStyle(group, "--zia-group-swatch", swatch || null);
  }

  function watchGroupColors() {
    const paintAll = () => document.querySelectorAll("tab-group:not([split-view-group])").forEach(paintGroupSwatch);
    for (const type of ["TabGroupCreate", "TabGroupUpdate"]) {
      gBrowser.tabContainer.addEventListener(type, (event) => paintGroupSwatch(event.target));
    }
    // Advanced Tab Groups recolours by writing --tab-group-color inline, without an event
    new MutationObserver((records) => {
      for (const record of records) {
        paintGroupSwatch(record.target);
      }
    }).observe(gBrowser.tabContainer, { subtree: true, attributes: true, attributeFilter: ["style"] });
    paintAll();
    setTimeout(paintAll, 1500);
  }

  function addFolderCloseButton(folder) {
    if (!folder?.isZenFolder) {
      return;
    }
    const header = folder.querySelector(":scope > .tab-group-label-container");
    if (!header || header.querySelector(":scope > .zia-folder-close")) {
      return;
    }
    const button = document.createXULElement("image");
    button.className = "zia-folder-close";
    button.setAttribute("role", "button");
    button.setAttribute("keyNav", "false");
    button.setAttribute("tooltiptext", "Delete Folder");
    button.addEventListener("mousedown", (event) => event.stopPropagation());
    button.addEventListener("click", (event) => {
      if (event.button !== 0) {
        return;
      }
      event.stopPropagation();
      event.preventDefault();
      const removal =
        typeof folder.delete === "function"
          ? folder.delete()
          : gBrowser.removeTabGroup(folder, { isUserTriggered: true });
      Promise.resolve(removal).catch((err) => console.error("[Zia] Couldn't delete the folder:", err));
    });
    header.appendChild(button);
  }

