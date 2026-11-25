# Mickey Studio - Motion Scene JSON Schema (v2)

This document defines the deterministic Scene JSON v2 specification shared between the Mickey Studio web application and the Adobe Premiere Pro CEP extension (`shared/motion-engine.js`).

---

## 1. Top-Level Scene Structure

```typescript
interface MotionSceneV2 {
  /** Schema specification version (must be 2) */
  version: 2;

  /** Unique scene identifier */
  id: string;

  /** Human-readable scene name */
  name: string;

  /** Canvas frame width in pixels (e.g. 1920, 1080) */
  width: number;

  /** Canvas frame height in pixels (e.g. 1080, 1920) */
  height: number;

  /** Target frames per second (e.g. 30, 60) */
  fps: number;

  /** Scene duration in seconds */
  duration: number;

  /** Background configuration */
  background: {
    type: 'transparent' | 'color' | 'gradient';
    color?: string; // Hex, rgb, rgba
    gradient?: {
      type: 'linear' | 'radial';
      stops: Array<{ offset: number; color: string }>;
      angle?: number; // In degrees (for linear)
    };
  };

  /** Optional Brand Kit identifier */
  brandKitId?: string;

  /** Ordered visual layers (rendered back to front) */
  layers: SceneLayer[];

  /** Audio tracks attached to scene */
  audio?: SceneAudioTrack[];
}
```

---

## 2. Layer Specification (`SceneLayer`)

```typescript
interface SceneLayer {
  /** Unique layer identifier */
  id: string;

  /** Layer kind */
  type: 'text' | 'shape' | 'image' | 'group' | 'counter' | 'chart';

  /** Friendly layer name */
  name: string;

  /** Start time in seconds relative to scene timeline */
  start: number;

  /** Duration of layer visibility in seconds */
  duration: number;

  /** Editing lock state */
  locked?: boolean;

  /** Visibility flag */
  visible?: boolean;

  /** Spatial transform properties */
  transform: {
    x: number;       // Center X position in pixels
    y: number;       // Center Y position in pixels
    w: number;       // Bounding width in pixels
    h: number;       // Bounding height in pixels
    rotation: number;// Rotation in degrees (0 - 360)
    scaleX: number;  // Horizontal scale multiplier (default 1.0)
    scaleY: number;  // Vertical scale multiplier (default 1.0)
    anchorX: number; // Normalized anchor point (0.0: left, 0.5: center, 1.0: right)
    anchorY: number; // Normalized anchor point (0.0: top, 0.5: middle, 1.0: bottom)
    opacity: number; // Layer opacity from 0.0 to 1.0
  };

  /** Visual and typographical styling */
  style: {
    fill?: string;        // Hex or rgba fill color
    stroke?: string;      // Outline color
    strokeWidth?: number; // Outline width in pixels
    shadow?: {
      color: string;
      blur: number;
      x: number;
      y: number;
    };
    blur?: number;        // Backdrop or filter blur
    radius?: number;      // Corner radius for shapes (pixels)
    font?: string;        // Font family name (e.g., 'Readex Pro', 'Cairo')
    fontSize?: number;    // Font size in pixels
    fontWeight?: number;  // 400, 600, 700, 800
    align?: 'left' | 'center' | 'right';
    direction?: 'rtl' | 'ltr';
    lineHeight?: number;  // Multiplier of font size (default 1.3)
    letterSpacing?: number;
    palette?: string[];   // Color palette for charts
  };

  /** Layer content payload depending on type */
  content: {
    text?: string;        // For type='text'
    src?: string;         // For type='image' (data URL or relative asset path)
    shape?: 'rect' | 'rounded-rect' | 'circle' | 'donut' | 'star' | 'line'; // For type='shape'
    value?: number;       // Target numeric value for type='counter'
    startValue?: number;  // Starting numeric value for type='counter'
    prefix?: string;      // Prefix (e.g. '$', '+') for type='counter'
    suffix?: string;      // Suffix (e.g. '%', 'K') for type='counter'
    decimals?: number;    // Floating point precision for type='counter'
    data?: number[];      // Values array for type='chart'
  };

  /**
   * Deterministic Property Keyframes
   * Key: Dot-notated property path (e.g. 'transform.x', 'transform.opacity')
   * Value: Array of keyframe entries sorted by timestamp
   */
  keyframes?: Record<string, Array<{
    t: number;            // Timestamp in seconds relative to layer start
    v: number | string;   // Target property value
    ease?: string;        // Easing name or cubic-bezier(...)
  }>>;

  /** Entry, exit, and continuous loop presets */
  presets?: {
    in?: {
      name: 'fade' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'pop' | 'typewriter';
      dur: number;
      ease?: string;
      params?: Record<string, any>;
    };
    out?: {
      name: 'fade' | 'slideDown' | 'slideUp' | 'scaleDown';
      dur: number;
      ease?: string;
      params?: Record<string, any>;
    };
    loop?: {
      name: 'float' | 'pulse' | 'spin' | 'wiggle';
      period: number;
      params?: {
        amplitude?: number;
      };
    };
  };

  /** Parenting for hierarchical transformation */
  parentId?: string | null;

  /** Masking reference */
  mask?: string | null;

  /** Canvas 2D compositing blend mode */
  blendMode?: GlobalCompositeOperation;
}
```

---

## 3. Audio Track Specification (`SceneAudioTrack`)

```typescript
interface SceneAudioTrack {
  id: string;
  src: string;          // Asset URI (WAV, MP3)
  start: number;        // Timeline offset in seconds
  volume: number;       // 0.0 to 1.0
  fadeIn?: number;      // Fade in duration in seconds
  fadeOut?: number;     // Fade out duration in seconds
  role: 'music' | 'sfx';// Track role
}
```

---

## 4. Supported Easing Functions

All easing functions accept a normalized progress value $t \in [0, 1]$ and return an output factor $f(t) \in [0, 1]$ (or slightly beyond for elastic/back):

- **Linear:** `linear`
- **Quad:** `easeInQuad`, `easeOutQuad`, `easeInOutQuad`
- **Cubic:** `easeInCubic` (`easeIn`), `easeOutCubic` (`easeOut`), `easeInOutCubic` (`easeInOut`)
- **Exponential:** `easeInExpo`, `easeOutExpo`, `easeInOutExpo`
- **Back:** `easeInBack`, `easeOutBack`, `easeInOutBack`
- **Elastic:** `easeInElastic`, `easeOutElastic`, `easeInOutElastic`
- **Bounce:** `easeInBounce`, `easeOutBounce`, `easeInOutBounce`
- **CSS Cubic-Bezier:** `cubic-bezier(x1, y1, x2, y2)` with Newton-Raphson precision

---

## 5. Sample Valid Scene JSON v2

```json
{
  "version": 2,
  "id": "scene_promo_01",
  "name": "Social Promo Kinetic Scene",
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "duration": 6.0,
  "background": {
    "type": "gradient",
    "gradient": {
      "type": "linear",
      "angle": 135,
      "stops": [
        { "offset": 0, "color": "#0d0d12" },
        { "offset": 1, "color": "#181824" }
      ]
    }
  },
  "layers": [
    {
      "id": "glow_accent",
      "type": "shape",
      "name": "Background Ring Accent",
      "start": 0.0,
      "duration": 6.0,
      "transform": {
        "x": 540,
        "y": 960,
        "w": 700,
        "h": 700,
        "rotation": 0,
        "scaleX": 1.0,
        "scaleY": 1.0,
        "anchorX": 0.5,
        "anchorY": 0.5,
        "opacity": 0.35
      },
      "style": {
        "fill": "#6366f1",
        "radius": 350
      },
      "content": {
        "shape": "donut",
        "innerRadius": 0.8
      },
      "presets": {
        "loop": { "name": "spin", "period": 10.0 }
      }
    },
    {
      "id": "headline_arabic",
      "type": "text",
      "name": "عنوان كينيتك عربي",
      "start": 0.4,
      "duration": 5.2,
      "transform": {
        "x": 540,
        "y": 880,
        "w": 920,
        "h": 220,
        "rotation": 0,
        "scaleX": 1.0,
        "scaleY": 1.0,
        "anchorX": 0.5,
        "anchorY": 0.5,
        "opacity": 1.0
      },
      "style": {
        "fill": "#ffffff",
        "font": "Readex Pro",
        "fontSize": 72,
        "fontWeight": 700,
        "align": "center",
        "direction": "rtl",
        "lineHeight": 1.25,
        "shadow": { "color": "rgba(0,0,0,0.6)", "blur": 16, "x": 0, "y": 6 }
      },
      "content": {
        "text": "اصنع فيديوهات احترافية\nبذكاء وسرعة فائقة"
      },
      "presets": {
        "in": { "name": "pop", "dur": 0.65 },
        "out": { "name": "fade", "dur": 0.4 }
      }
    },
    {
      "id": "growth_metric",
      "type": "counter",
      "name": "مؤشر إحصائي متصاعد",
      "start": 1.0,
      "duration": 4.6,
      "transform": {
        "x": 540,
        "y": 1180,
        "w": 400,
        "h": 120,
        "rotation": 0,
        "scaleX": 1.0,
        "scaleY": 1.0,
        "anchorX": 0.5,
        "anchorY": 0.5,
        "opacity": 1.0
      },
      "style": {
        "fill": "#38bdf8",
        "font": "Inter",
        "fontSize": 84,
        "fontWeight": 800
      },
      "content": {
        "startValue": 0,
        "value": 2450,
        "suffix": "+",
        "decimals": 0
      },
      "presets": {
        "in": { "name": "slideUp", "dur": 0.5 }
      }
    }
  ],
  "audio": [
    {
      "id": "bg_beat",
      "src": "assets/motion-audio/music/social_upbeat.wav",
      "start": 0.0,
      "volume": 0.35,
      "fadeIn": 1.0,
      "fadeOut": 1.5,
      "role": "music"
    }
  ]
}
```
