/**
 * Mickey Studio - Universal Floating Tooltip Engine
 * High-performance, zero-clipping tooltips with rich Arabic titles & subtitles.
 * Works seamlessly in Adobe Premiere UXP / CEP Panels and Web Browsers.
 */
(function () {
  'use strict';

  // Tool metadata dictionary for instant, crystal-clear recognition
  // Tool metadata dictionary for instant, crystal-clear recognition
  const TOOL_REGISTRY = {
    // 1. Extension Main Sidebar Tools
    'create': {
      title: 'توليد وتصميم الصور',
      sub: 'AI Image Studio · توليد وتعديل الصور',
      color: '#fbbf24'
    },
    'shortcuts': {
      title: 'اختصارات المؤثرات',
      sub: 'فلاتر وانتقالات للتايملاين بنقرة',
      color: '#f97316'
    },
    'voiceover': {
      title: 'التعليق الصوتي العربي',
      sub: 'توليد أصوات بشرية احترافية',
      color: '#38bdf8'
    },
    'podcast': {
      title: 'استوديو البودكاست الثنائي',
      sub: 'حوار ذكي وتبادل أدوار بين صوتين',
      color: '#c084fc'
    },
    'audiobook': {
      title: 'استوديو الروايات والكتب',
      sub: 'تحويل النصوص لروايات مسموعة',
      color: '#f472b6'
    },
    'transcript': {
      title: 'تفريغ وفهرسة الصوت',
      sub: 'تحويل الكلام إلى نصوص وتوقيتات',
      color: '#60a5fa'
    },
    'photolab': {
      title: 'معمل الصور (Photo Lab)',
      sub: 'إزالة الخلفيات وتكبير الدقة 4K',
      color: '#e879f9'
    },
    'quickcut': {
      title: 'استوديو AutoCut للمونتاج',
      sub: 'قص السكتات والزووم السينمائي',
      color: '#34d399'
    },
    'safezone': {
      title: 'سيف زون المنصات',
      sub: 'معاينة هوامش Reels و TikTok',
      color: '#a3e635'
    },
    'organizer': {
      title: 'ترتيب ملفات المشروع',
      sub: 'فرز وتصنيف عناصر العمل بمجلدات',
      color: '#818cf8'
    },
    'library': {
      title: 'مكتبة الميديا والمؤثرات',
      sub: 'مؤثرات بصرية وصوتية جاهزة',
      color: '#2dd4bf'
    },

    // 2. Web Studios (Website Sidebar)
    'image-studio': {
      title: 'استوديو توليد الصور',
      sub: 'إنشاء مشاهد واقعية فائقة الدقة',
      color: '#fbbf24'
    },
    'video-studio': {
      title: 'استوديو الفيديو والتحريك',
      sub: 'تحويل الصور لفيديو سينمائي',
      color: '#818cf8'
    },
    'photo-lab': {
      title: 'تعديل وتكبير الصور',
      sub: 'رفع الجودة وعزل الخلفيات بالذكاء',
      color: '#e879f9'
    },
    'voice-studio': {
      title: 'استوديو التعليق الصوتي',
      sub: 'أصوات طبيعية ولهجات متعددة',
      color: '#38bdf8'
    },
    'podcast-studio': {
      title: 'استوديو البودكاست الثنائي',
      sub: 'حوار ثنائي ومؤثرات صوتية سينمائية',
      color: '#c084fc'
    },
    'audiobook-studio': {
      title: 'استوديو الكتب والروايات',
      sub: 'سرد روائي وتقسيم فصول ذكي',
      color: '#f472b6'
    },
    'transcribe-studio': {
      title: 'تفريغ وترجمة الصوت',
      sub: 'تفريغ دقيق مع التوقيت والترجمة',
      color: '#60a5fa'
    },
    'autocut-suite': {
      title: 'استوديو AutoCut للمونتاج',
      sub: 'قص الصمت والزووم ومقاطع الريلز',
      color: '#34d399'
    },
    'vault-gallery': {
      title: 'معرض الأعمال (Vault)',
      sub: 'أرشيف الأعمال وسجل التوليدات',
      color: '#94a3b8'
    },
    'developer-api': {
      title: 'بوابة المطورين (API)',
      sub: 'مفاتيح الربط والتوثيق البرمجي',
      color: '#22d3ee'
    },

    // 3. AutoCut Sub-tools (Extension & Web)
    'silence': {
      title: 'قص السكتات والفراغات',
      sub: 'حذف فترات الصمت من التايملاين',
      color: '#10b981'
    },
    'zoom': {
      title: 'الزووم الديناميكي',
      sub: 'تقريب الكاميرا بحركات Whoosh',
      color: '#06b6d4'
    },
    'censor': {
      title: 'حجب الكلمات (صفارة)',
      sub: 'كتم الألفاظ بصفارة الرقابة',
      color: '#f43f5e'
    },
    'viral': {
      title: 'مقاطع فيروسية (Reels)',
      sub: 'استخراج اللحظات لفيديوهات عمودية',
      color: '#f59e0b'
    },
    'chapters': {
      title: 'فصول يوتيوب والماركرز',
      sub: 'فهرسة الفصول وعلامات التايملاين',
      color: '#3b82f6'
    },
    'multicam': {
      title: 'مونتاج الكاميرات المتعددة',
      sub: 'تبديل الزوايا تلقائياً للمتحدث',
      color: '#a855f7'
    }
  };

  // Specific elements with custom tooltips
  const ID_REGISTRY = {
    'btn-reload-extension': {
      title: 'تحديث الإضافة',
      sub: 'إعادة تحميل اللوحة والاتصال ببريمير',
      color: '#66ddc5'
    },
    'settings-open': {
      title: 'حساب المنصة',
      sub: 'إدارة الرصيد والاشتراك السحابي',
      color: '#66ddc5'
    },
    'btn-header-account': {
      title: 'حساب المنصة',
      sub: 'إدارة الرصيد والاشتراك السحابي',
      color: '#66ddc5'
    },
    'btn-google-login': {
      title: 'تسجيل الدخول',
      sub: 'ربط الحساب ومزامنة الرصيد',
      color: '#6366f1'
    },
    'btn-toggle-sfx': {
      title: 'المؤثرات الصوتية',
      sub: 'كتم أو تفعيل أصوات الواجهة',
      color: '#eab308'
    },
    'btn-enhance-image-prompt': {
      title: 'تحسين الوصف ✨',
      sub: 'إضافة تفاصيل سينمائية تلقائياً',
      color: '#60a5fa'
    },
    'btn-generate-image': {
      title: 'بدء التوليد',
      sub: 'إرسال الأمر لمحرك الذكاء الاصطناعي',
      color: '#ffffff'
    },
    'quickcut-analyze': {
      title: 'تحليل وقص السكتات',
      sub: 'فحص التايملاين وإزالة الفراغات',
      color: '#34d399'
    },
    'btn-apply-autozoom': {
      title: 'تطبيق الزووم',
      sub: 'إضافة حركات التقريب السينمائية',
      color: '#06b6d4'
    },
    'btn-photolab-mode-bg': {
      title: 'إزالة الخلفية',
      sub: 'عزل العنصر وتصدير PNG شفاف',
      color: '#66ddc5'
    },
    'btn-photolab-mode-upscale': {
      title: 'تكبير الجودة (4K)',
      sub: 'مضاعفة الدقة وتوضيح التفاصيل',
      color: '#38bdf8'
    },
    'btn-photolab-src-timeline': {
      title: 'صورة من التايملاين',
      sub: 'استهداف المقطع المحدد في بريمير',
      color: '#e879f9'
    },
    'btn-photolab-src-browse': {
      title: 'استعراض من الجهاز',
      sub: 'اختيار صورة من القرص الصلب',
      color: '#a855f7'
    },
    'btn-photolab-src-last': {
      title: 'آخر صورة منشأة',
      sub: 'استخدام أحدث صورة تم توليدها',
      color: '#f59e0b'
    },
    'btn-photolab-refresh-clip': {
      title: 'تحديث الاختيار 🔄',
      sub: 'إعادة قراءة الصورة المحددة حالياً',
      color: '#66ddc5'
    },
    'btn-photolab-action': {
      title: 'بدء المعالجة',
      sub: 'تطبيق الذكاء وحفظ الناتج في المشروع',
      color: '#66ddc5'
    }
  };

  let tooltipEl = null;
  let titleEl = null;
  let descEl = null;
  let dotEl = null;
  let currentTarget = null;
  let hideTimer = null;

  function initTooltipDOM() {
    if (document.getElementById('mickey-studio-tooltip')) return;

    // Inject styles
    const style = document.createElement('style');
    style.id = 'mickey-tooltip-style';
    style.textContent = `
      #mickey-studio-tooltip {
        position: fixed;
        z-index: 9999999;
        pointer-events: none;
        opacity: 0;
        visibility: hidden;
        transform: scale(0.96) translateY(2px);
        transition: opacity 0.12s ease, transform 0.12s ease;
        background: rgba(15, 17, 21, 0.97);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.14);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7), 0 0 1px rgba(255, 255, 255, 0.18);
        border-radius: 7px;
        padding: 4px 8px;
        max-width: 190px;
        min-width: 110px;
        width: max-content;
        direction: rtl;
        text-align: right;
        font-family: 'Cairo', 'Readex Pro', -apple-system, BlinkMacSystemFont, sans-serif;
        line-height: 1.25;
        box-sizing: border-box;
      }

      #mickey-studio-tooltip.visible {
        opacity: 1;
        visibility: visible;
        transform: scale(1) translateY(0);
      }

      .mst-header {
        display: flex;
        align-items: center;
        gap: 5px;
        margin-bottom: 1px;
      }

      .mst-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #66ddc5;
        box-shadow: 0 0 6px currentColor;
        flex-shrink: 0;
      }

      .mst-title {
        font-size: 10.5px;
        font-weight: 700;
        color: #ffffff;
        letter-spacing: -0.1px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.2;
      }

      .mst-desc {
        font-size: 9px;
        color: #94a3b8;
        font-weight: 400;
        line-height: 1.25;
        margin-top: 1px;
        white-space: normal;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .mst-arrow {
        position: absolute;
        width: 7px;
        height: 7px;
        background: rgba(15, 17, 21, 0.97);
        transform: rotate(45deg);
        pointer-events: none;
        box-sizing: border-box;
      }
    `;
    document.head.appendChild(style);

    // Create Tooltip Box
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'mickey-studio-tooltip';
    tooltipEl.setAttribute('aria-hidden', 'true');
    tooltipEl.innerHTML = `
      <div class="mst-header">
        <span class="mst-dot" id="mst-dot"></span>
        <span class="mst-title" id="mst-title"></span>
      </div>
      <div class="mst-desc" id="mst-desc"></div>
      <div class="mst-arrow" id="mst-arrow"></div>
    `;
    document.body.appendChild(tooltipEl);

    titleEl = tooltipEl.querySelector('#mst-title');
    descEl = tooltipEl.querySelector('#mst-desc');
    dotEl = tooltipEl.querySelector('#mst-dot');
  }

  function resolveTooltipInfo(target) {
    if (!target) return null;

    // Check by ID first
    if (target.id && ID_REGISTRY[target.id]) {
      return ID_REGISTRY[target.id];
    }

    // Check by data-page (Premiere extension sidebar)
    const dataPage = target.getAttribute('data-page') || target.dataset?.page;
    if (dataPage && TOOL_REGISTRY[dataPage]) {
      return TOOL_REGISTRY[dataPage];
    }

    // Check by data-autocut (AutoCut cards)
    const dataAutoCut = target.getAttribute('data-autocut') || target.dataset?.autocut;
    if (dataAutoCut && TOOL_REGISTRY[dataAutoCut]) {
      return TOOL_REGISTRY[dataAutoCut];
    }

    // Check by onclick or id matching tab
    const id = target.id || '';
    for (const [key, val] of Object.entries(TOOL_REGISTRY)) {
      if (id.includes(key)) return val;
    }

    // Check data-tooltip or custom attributes
    const customTitle = target.getAttribute('data-tooltip') || target.getAttribute('data-tooltip-title');
    const customDesc = target.getAttribute('data-tooltip-sub') || target.getAttribute('data-tooltip-desc');
    if (customTitle) {
      return {
        title: customTitle,
        sub: customDesc || '',
        color: '#66ddc5'
      };
    }

    // Check host status
    if (target.classList?.contains('host-status')) {
      return {
        title: 'حالة الاتصال بـ Premiere Pro',
        sub: 'مؤشر فحص وتزامن اللوحة الحية مع بيئة أدوبي بريمير',
        color: '#10b981'
      };
    }

    // Check ratio buttons
    if (target.classList?.contains('ratio-btn')) {
      const text = (target.textContent || '').replace(/\s+/g, ' ').trim();
      return {
        title: 'نسبة أبعاد الصورة',
        sub: `ضبط مقاس وتنسيق الإطار: ${text}`,
        color: '#38bdf8'
      };
    }

    // Check style pill options
    if (target.classList?.contains('pill-option') && target.closest?.('#image-style-tags')) {
      return {
        title: 'أسلوب التصوير الواقعي',
        sub: `تطبيق النمط البصري: ${(target.textContent || '').trim()}`,
        color: '#e879f9'
      };
    }

    // Check batch buttons
    if (target.classList?.contains('batch-count-btn')) {
      return {
        title: 'عدد الصور المولدة دفعة واحدة',
        sub: `توليد ${(target.textContent || '').trim()} خيارات بصرية في نفس اللحظة`,
        color: '#f59e0b'
      };
    }

    // Check native title attribute as fallback
    const nativeTitle = target.getAttribute('data-mst-saved-title') || target.getAttribute('title') || target.getAttribute('aria-label');
    if (nativeTitle && nativeTitle.trim().length > 1) {
      // Split by colon or dash if present
      const parts = nativeTitle.split(/[:·-]/);
      return {
        title: parts[0].trim(),
        sub: parts.slice(1).join(' - ').trim(),
        color: '#66ddc5'
      };
    }

    return null;
  }

  function positionTooltip(target, info) {
    if (!tooltipEl || !target) return;

    titleEl.textContent = info.title;
    if (info.sub) {
      descEl.textContent = info.sub;
      descEl.style.display = '-webkit-box';
    } else {
      descEl.textContent = '';
      descEl.style.display = 'none';
    }

    const color = info.color || '#66ddc5';
    dotEl.style.background = color;
    dotEl.style.boxShadow = `0 0 6px ${color}`;
    tooltipEl.style.borderColor = `${color}44`;

    const arrow = tooltipEl.querySelector('#mst-arrow');

    // Reset styles for measurement
    tooltipEl.style.maxWidth = '190px';
    tooltipEl.style.left = '-9999px';
    tooltipEl.style.top = '-9999px';
    tooltipEl.classList.add('visible');

    const targetRect = target.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Check if target is docked on the right or left edge (e.g. sidebar navigation)
    const isFullWidth = targetRect.width > viewportWidth * 0.55;
    const isSidebarItem = Boolean(target.closest('.sidebar, aside, [aria-label*="أقسام"], .sidebar-nav-item, .nav-item'));
    const isRightDock = !isFullWidth && (
      isSidebarItem ||
      (targetRect.right >= viewportWidth - 85 && targetRect.left >= viewportWidth * 0.5)
    );
    const isLeftDock = !isFullWidth && !isSidebarItem && (
      targetRect.left <= 85 && targetRect.right <= viewportWidth * 0.5
    );

    // Dynamic max-width adaptation for narrow screens
    if (isRightDock && targetRect.left < 210) {
      const allowedWidth = Math.max(110, Math.floor(targetRect.left - 16));
      tooltipEl.style.maxWidth = `${allowedWidth}px`;
    }

    const tipRect = tooltipEl.getBoundingClientRect();
    const GAP = 7;

    let left = 0;
    let top = 0;
    let arrowStyle = {};
    const borderColor = `${color}55`;

    if (isRightDock && targetRect.left >= 110) {
      // 1. Position to the LEFT of the element (directly hugging the icon)
      left = targetRect.left - tipRect.width - GAP;
      top = targetRect.top + (targetRect.height / 2) - (tipRect.height / 2);

      // Clamp vertical position so it stays fully inside viewport
      const clampedTop = Math.max(8, Math.min(viewportHeight - tipRect.height - 8, top));
      top = clampedTop;

      // Ensure left doesn't go off-screen
      left = Math.max(8, left);

      // Calculate arrow position pointing precisely at target vertical center
      const targetCenterY = targetRect.top + (targetRect.height / 2);
      const arrowRelY = targetCenterY - top - 3.5;
      const clampedArrowTop = Math.max(6, Math.min(tipRect.height - 13, arrowRelY));

      arrowStyle = {
        right: '-4px',
        left: 'auto',
        top: `${Math.round(clampedArrowTop)}px`,
        bottom: 'auto',
        borderLeft: 'none',
        borderBottom: 'none',
        borderTop: `1px solid ${borderColor}`,
        borderRight: `1px solid ${borderColor}`
      };

    } else if (isLeftDock) {
      // 2. Position to the RIGHT of the element
      left = targetRect.right + GAP;
      top = targetRect.top + (targetRect.height / 2) - (tipRect.height / 2);

      const clampedTop = Math.max(8, Math.min(viewportHeight - tipRect.height - 8, top));
      top = clampedTop;

      left = Math.min(viewportWidth - tipRect.width - 8, left);

      const targetCenterY = targetRect.top + (targetRect.height / 2);
      const arrowRelY = targetCenterY - top - 3.5;
      const clampedArrowTop = Math.max(6, Math.min(tipRect.height - 13, arrowRelY));

      arrowStyle = {
        left: '-4px',
        right: 'auto',
        top: `${Math.round(clampedArrowTop)}px`,
        bottom: 'auto',
        borderRight: 'none',
        borderTop: 'none',
        borderLeft: `1px solid ${borderColor}`,
        borderBottom: `1px solid ${borderColor}`
      };

    } else {
      // 3. Floating above or below element (Centered horizontally)
      left = targetRect.left + (targetRect.width / 2) - (tipRect.width / 2);
      top = targetRect.top - tipRect.height - GAP;

      const targetCenterX = targetRect.left + (targetRect.width / 2);

      // If cut off at the top (e.g. topbar buttons), place BELOW
      if (top < 10) {
        top = targetRect.bottom + GAP;
        // Clamp inside viewport
        left = Math.max(8, Math.min(viewportWidth - tipRect.width - 8, left));
        top = Math.max(8, Math.min(viewportHeight - tipRect.height - 8, top));

        const arrowRelX = targetCenterX - left - 3.5;
        const clampedArrowLeft = Math.max(8, Math.min(tipRect.width - 15, arrowRelX));

        arrowStyle = {
          top: '-4px',
          bottom: 'auto',
          left: `${Math.round(clampedArrowLeft)}px`,
          right: 'auto',
          borderRight: 'none',
          borderBottom: 'none',
          borderTop: `1px solid ${borderColor}`,
          borderLeft: `1px solid ${borderColor}`
        };
      } else {
        // Position ABOVE
        left = Math.max(8, Math.min(viewportWidth - tipRect.width - 8, left));
        top = Math.max(8, Math.min(viewportHeight - tipRect.height - 8, top));

        const arrowRelX = targetCenterX - left - 3.5;
        const clampedArrowLeft = Math.max(8, Math.min(tipRect.width - 15, arrowRelX));

        arrowStyle = {
          bottom: '-4px',
          top: 'auto',
          left: `${Math.round(clampedArrowLeft)}px`,
          right: 'auto',
          borderLeft: 'none',
          borderTop: 'none',
          borderRight: `1px solid ${borderColor}`,
          borderBottom: `1px solid ${borderColor}`
        };
      }
    }

    tooltipEl.style.left = `${Math.round(left)}px`;
    tooltipEl.style.top = `${Math.round(top)}px`;

    // Apply arrow style
    if (arrow) {
      Object.assign(arrow.style, {
        top: '', bottom: '', left: '', right: '',
        borderTop: '', borderBottom: '', borderLeft: '', borderRight: '',
        background: 'rgba(15, 17, 21, 0.97)',
        ...arrowStyle
      });
    }
  }

  function showTooltip(target) {
    if (!target) return;
    initTooltipDOM();

    // Prevent clashing with browser's native delayed title tooltip
    if (target.hasAttribute('title')) {
      const titleVal = target.getAttribute('title');
      if (titleVal) {
        target.setAttribute('data-mst-saved-title', titleVal);
        target.removeAttribute('title');
      }
    }

    const info = resolveTooltipInfo(target);
    if (!info) return;

    clearTimeout(hideTimer);
    currentTarget = target;
    positionTooltip(target, info);
  }

  function hideTooltip() {
    clearTimeout(hideTimer);
    if (tooltipEl) {
      tooltipEl.classList.remove('visible');
    }
    if (currentTarget) {
      // Restore native title if it was saved
      if (currentTarget.hasAttribute('data-mst-saved-title')) {
        const saved = currentTarget.getAttribute('data-mst-saved-title');
        currentTarget.setAttribute('title', saved);
        currentTarget.removeAttribute('data-mst-saved-title');
      }
      currentTarget = null;
    }
  }

  // Find nearest interactive target
  function findTooltipTarget(node) {
    if (!node || node === document.body || node === document.documentElement) return null;
    return node.closest?.([
      '.nav-item',
      '.sidebar-nav-item',
      '.autocut-card',
      '.reload-button',
      '.header-account-btn',
      '.host-status',
      '[data-page]',
      '[data-autocut]',
      '[data-tooltip]',
      '#btn-reload-extension',
      '#btn-header-account',
      '#btn-google-login',
      '#btn-toggle-sfx',
      '#btn-enhance-image-prompt',
      '#quickcut-analyze',
      '#btn-apply-autozoom',
      '#subtab-autocut-silence',
      '#subtab-autocut-zoom',
      '#subtab-autocut-censor',
      '#subtab-autocut-viral',
      '#subtab-autocut-chapters',
      '#subtab-autocut-multicam',
      '#btn-photolab-mode-bg',
      '#btn-photolab-mode-upscale',
      '#btn-photolab-src-timeline',
      '#btn-photolab-src-browse',
      '#btn-photolab-src-last',
      '#btn-photolab-refresh-clip',
      '#btn-photolab-action',
      '.photolab-mode-btn',
      '.ratio-btn',
      '.batch-count-btn',
      '[title]'
    ].join(', '));
  }

  // Global Event Delegation (Smooth, Zero-Overhead)
  document.addEventListener('mouseover', function (event) {
    const target = findTooltipTarget(event.target);
    if (target) {
      if (target !== currentTarget) {
        showTooltip(target);
      }
    } else if (currentTarget) {
      hideTooltip();
    }
  }, { passive: true });

  document.addEventListener('mouseout', function (event) {
    if (currentTarget && !currentTarget.contains(event.relatedTarget)) {
      hideTooltip();
    }
  }, { passive: true });

  document.addEventListener('click', function () {
    hideTooltip();
  }, { passive: true });

  window.addEventListener('scroll', function () {
    hideTooltip();
  }, { passive: true });

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTooltipDOM);
  } else {
    initTooltipDOM();
  }

})();
