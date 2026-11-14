'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  GARMENTS,
  INITIAL_CART,
  RAIL_ORDER,
  SHEET_URLS,
  SIZES,
  TAG_ROTATIONS,
  type CartItem,
  type GarmentDef,
  type GarmentSize,
  type GarmentView,
} from '@/lib/garments';
import {
  addItemToCart,
  computeCartTotals,
  computeCropLayout,
  computeMaxScroll,
  computeMobileQvScale,
  computeNeighborOffset,
  computeRailPath,
  computeRailY,
  computeScaleUnit,
  formatCurrency,
  getRailParams,
  removeCartItem,
  stepScroll,
  stepSway,
  updateCartQty,
} from '@/lib/rail-math';

interface QuickViewState {
  index: number;
  k: number;
  garment: GarmentDef;
}

interface ViewportMetrics {
  width: number;
  height: number;
  u: number;
}

const SERVER_VIEWPORT: ViewportMetrics = { width: 1440, height: 900, u: 1 };
let cachedViewport: ViewportMetrics = SERVER_VIEWPORT;

function getViewportSnapshot(): ViewportMetrics {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w <= 0 || h <= 0) return cachedViewport;
  if (cachedViewport.width === w && cachedViewport.height === h) {
    return cachedViewport;
  }
  cachedViewport = { width: w, height: h, u: computeScaleUnit(w, h) };
  return cachedViewport;
}

function getServerViewportSnapshot(): ViewportMetrics {
  return SERVER_VIEWPORT;
}

function subscribeViewport(cb: () => void): () => void {
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
}

function subscribeMediaQuery(query: string, cb: () => void): () => void {
  const mq = window.matchMedia(query);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export default function MaisonVerrel() {
  const viewport = useSyncExternalStore(
    subscribeViewport,
    getViewportSnapshot,
    getServerViewportSnapshot
  );
  const { u, width: viewportWidth, height: viewportHeight } = viewport;

  const isTouch = useSyncExternalStore(
    useCallback((cb: () => void) => subscribeMediaQuery('(hover: none)', cb), []),
    () => window.matchMedia('(hover: none)').matches,
    () => false
  );

  const reducedMotion = useSyncExternalStore(
    useCallback(
      (cb: () => void) =>
        subscribeMediaQuery('(prefers-reduced-motion: reduce)', cb),
      []
    ),
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false
  );

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hiddenRailIndex, setHiddenRailIndex] = useState<number | null>(null);

  const [qvItem, setQvItem] = useState<QuickViewState | null>(null);
  const [qvView, setQvView] = useState<GarmentView>('front');
  const [qvSize, setQvSize] = useState<GarmentSize>('S');
  const [isAdding, setIsAdding] = useState<boolean>(false);

  const [cart, setCart] = useState<CartItem[]>(INITIAL_CART);
  const [cartOpen, setCartOpen] = useState<boolean>(false);

  // Refs for 60fps imperative DOM updates without React re-renders
  const pageRef = useRef<HTMLDivElement | null>(null);
  const railZoneRef = useRef<HTMLDivElement | null>(null);
  const railShadowPathRef = useRef<SVGPathElement | null>(null);
  const railMainPathRef = useRef<SVGPathElement | null>(null);
  const railHighlightPathRef = useRef<SVGPathElement | null>(null);
  const progressThumbRef = useRef<HTMLDivElement | null>(null);

  const garmentElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const dropElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const swayElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const sideFaceElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const frontFaceElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const wordElsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const footerLeftRef = useRef<HTMLDivElement | null>(null);
  const progressElRef = useRef<HTMLDivElement | null>(null);
  const footerRightRef = useRef<HTMLDivElement | null>(null);

  const qvImgRef = useRef<HTMLDivElement | null>(null);
  const qvFrontFaceRef = useRef<HTMLDivElement | null>(null);
  const qvBackFaceRef = useRef<HTMLDivElement | null>(null);
  const qvInfoRef = useRef<HTMLDivElement | null>(null);
  const bagBtnRef = useRef<HTMLButtonElement | null>(null);
  const bagBadgeRef = useRef<HTMLSpanElement | null>(null);

  // Mutable animation/physics state
  const uRef = useRef<number>(u);
  const vpWidthRef = useRef<number>(viewportWidth);
  const hoveredIdxRef = useRef<number | null>(null);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const qvOpenRef = useRef<boolean>(false);
  const cartOpenRef = useRef<boolean>(false);
  const isAddingRef = useRef<boolean>(false);

  const targetScrollRef = useRef<number>(0);
  const curScrollRef = useRef<number>(0);
  const railVelRef = useRef<number>(0);
  const offsetsRef = useRef<number[]>(new Array(RAIL_ORDER.length).fill(0));
  const swayAngleRef = useRef<number[]>(new Array(RAIL_ORDER.length).fill(0));
  const swayVelRef = useRef<number[]>(new Array(RAIL_ORDER.length).fill(0));

  const sheetPromisesRef = useRef<Record<GarmentView, Promise<void>> | null>(
    null
  );
  const sheetLoadedRef = useRef<Record<GarmentView, boolean>>({
    side: false,
    front: false,
    back: false,
  });

  const qvTokenRef = useRef<number>(0);
  const qvAnimRef = useRef<Animation | null>(null);
  const addTimerRef = useRef<number | null>(null);
  const suppressClickUntilRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  useEffect(() => {
    hoveredIdxRef.current = hoveredIdx;
  }, [hoveredIdx]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    uRef.current = u;
    vpWidthRef.current = viewportWidth;
    document.documentElement.style.setProperty('--u', `${u}px`);
  }, [u, viewportWidth]);

  useEffect(() => {
    qvOpenRef.current = qvItem !== null;
    if (qvItem !== null) {
      document.body.classList.add('qv-open');
    } else {
      document.body.classList.remove('qv-open');
    }
  }, [qvItem]);

  useEffect(() => {
    cartOpenRef.current = cartOpen;
    if (cartOpen) {
      document.body.classList.add('cart-open');
    } else {
      document.body.classList.remove('cart-open');
    }
  }, [cartOpen]);

  useEffect(() => {
    isAddingRef.current = isAdding;
  }, [isAdding]);

  // Sheet preloading and one-time intro sequence
  useEffect(() => {
    // Preload all 3 transparent WebP product sheets
    const loadSheet = (view: GarmentView): Promise<void> =>
      new Promise((resolve) => {
        const img = new window.Image();
        img.decoding = 'async';
        img.onload = () => {
          const done = () => {
            sheetLoadedRef.current[view] = true;
            resolve();
          };
          if (typeof img.decode === 'function') {
            img.decode().then(done).catch(done);
          } else {
            done();
          }
        };
        img.onerror = () => resolve();
        img.src = SHEET_URLS[view];
      });

    const promises: Record<GarmentView, Promise<void>> = {
      side: loadSheet('side'),
      front: loadSheet('front'),
      back: loadSheet('back'),
    };
    sheetPromisesRef.current = promises;

    let introStarted = false;
    const impulseTimers: number[] = [];

    const startIntro = () => {
      if (introStarted) return;
      introStarted = true;
      document.documentElement.classList.remove('is-loading');

      if (reducedMotionRef.current) return;

      const curU = uRef.current;

      // Garments drop in one by one with alternating swing impulse
      for (let i = 0; i < RAIL_ORDER.length; i++) {
        const dropEl = dropElsRef.current[i];
        if (dropEl) {
          dropEl.animate(
            [
              {
                transform: `translateY(${-42 * curU}px)`,
                opacity: 0,
                filter: 'blur(6px)',
              },
              {
                transform: 'translateY(0px)',
                opacity: 1,
                filter: 'blur(0px)',
              },
            ],
            {
              duration: 620,
              delay: i * 70,
              easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
              fill: 'backwards',
            }
          );
        }
        const timerId = window.setTimeout(() => {
          swayVelRef.current[i] += (i % 2 === 0 ? 1 : -1) * 1.6;
        }, i * 70 + 420);
        impulseTimers.push(timerId);
      }

      // Headline words sharpen from blur
      for (let j = 0; j < 4; j++) {
        const wordEl = wordElsRef.current[j];
        if (wordEl) {
          wordEl.animate(
            [
              {
                filter: 'blur(12px)',
                opacity: 0,
                transform: `translateY(${6 * curU}px)`,
              },
              {
                filter: 'blur(0px)',
                opacity: 1,
                transform: 'translateY(0px)',
              },
            ],
            {
              duration: 820,
              delay: 60 + j * 110,
              easing: 'cubic-bezier(0.25, 0.8, 0.3, 1)',
              fill: 'backwards',
            }
          );
        }
      }

      // Footer elements fade in
      const footerSpecs: [HTMLElement | null, number][] = [
        [footerLeftRef.current, 600],
        [progressElRef.current, 680],
        [footerRightRef.current, 760],
      ];
      for (const [el, delay] of footerSpecs) {
        if (el) {
          el.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 420,
            delay,
            easing: 'ease-out',
            fill: 'backwards',
          });
        }
      }
    };

    const fontsReady =
      document.fonts && document.fonts.ready
        ? document.fonts.ready.catch(() => undefined)
        : Promise.resolve();

    const readyPromise = Promise.all([
      fontsReady,
      promises.side,
      promises.front,
    ]);
    const failsafeTimer = window.setTimeout(startIntro, 2500);
    readyPromise.then(() => {
      window.clearTimeout(failsafeTimer);
      startIntro();
    });

    return () => {
      window.clearTimeout(failsafeTimer);
      for (const id of impulseTimers) window.clearTimeout(id);
      if (addTimerRef.current !== null) {
        window.clearTimeout(addTimerRef.current);
      }
      document.body.classList.remove('qv-open', 'cart-open');
    };
  }, []);

  // Single requestAnimationFrame loop for rail curve, scroll inertia, neighbor parting, and sway physics
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let lastPathKey = '';

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.667, 3);
      lastTime = now;

      const curU = uRef.current;
      const vpW = vpWidthRef.current;
      const params = getRailParams(vpW);
      const pageW = pageRef.current?.clientWidth || vpW;

      if (curU > 0 && pageW > 0) {
        const maxScroll = computeMaxScroll(
          params.start,
          params.gap,
          RAIL_ORDER.length,
          curU,
          pageW
        );
        targetScrollRef.current = clamp(targetScrollRef.current, 0, maxScroll);

        const nextScroll = stepScroll(
          curScrollRef.current,
          targetScrollRef.current,
          dt
        );
        curScrollRef.current = nextScroll.cur;
        railVelRef.current = nextScroll.vel;

        // Redraw SVG rail if pageWidth or u changed (e.g. during cart drawer slide or resize)
        const pathKey = `${pageW.toFixed(1)}_${curU.toFixed(4)}_${params.railTop}_${params.sag}`;
        if (pathKey !== lastPathKey) {
          lastPathKey = pathKey;
          const pathD = computeRailPath(
            pageW,
            params.railTop,
            params.sag,
            curU
          );
          if (railShadowPathRef.current) {
            railShadowPathRef.current.setAttribute('d', pathD);
            railShadowPathRef.current.setAttribute(
              'transform',
              `translate(0, ${(4 * curU).toFixed(2)})`
            );
            railShadowPathRef.current.setAttribute(
              'stroke-width',
              (3 * curU).toFixed(2)
            );
          }
          if (railMainPathRef.current) {
            railMainPathRef.current.setAttribute('d', pathD);
            railMainPathRef.current.setAttribute(
              'stroke-width',
              (5.2 * curU).toFixed(2)
            );
          }
          if (railHighlightPathRef.current) {
            railHighlightPathRef.current.setAttribute('d', pathD);
            railHighlightPathRef.current.setAttribute(
              'transform',
              `translate(0, ${(-1.3 * curU).toFixed(2)})`
            );
            railHighlightPathRef.current.setAttribute(
              'stroke-width',
              (1.1 * curU).toFixed(2)
            );
          }
        }

        // Update progress thumb
        if (progressThumbRef.current) {
          const progress = maxScroll > 0 ? curScrollRef.current / maxScroll : 0;
          progressThumbRef.current.style.left = `${(clamp(progress, 0, 1) * 42).toFixed(3)}%`;
        }

        // Position garments & step sway springs
        const hovIdx = hoveredIdxRef.current;
        const reduced = reducedMotionRef.current;
        const offsetEase = 1 - Math.pow(1 - 0.16, dt);

        for (let i = 0; i < RAIL_ORDER.length; i++) {
          const targetOffset = computeNeighborOffset(
            i,
            hovIdx,
            params.gs,
            curU
          );
          offsetsRef.current[i] +=
            (targetOffset - offsetsRef.current[i]) * offsetEase;

          const x =
            (params.start + i * params.gap) * curU -
            curScrollRef.current +
            offsetsRef.current[i];
          const y =
            computeRailY(x, pageW, params.railTop, params.sag, curU) -
            3 * curU -
            params.zoneTop * curU;

          const gEl = garmentElsRef.current[i];
          if (gEl) {
            gEl.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
          }

          const sway = stepSway(
            swayAngleRef.current[i],
            swayVelRef.current[i],
            railVelRef.current,
            dt,
            reduced
          );
          swayAngleRef.current[i] = sway.angle;
          swayVelRef.current[i] = sway.angVel;

          const swayEl = swayElsRef.current[i];
          if (swayEl) {
            swayEl.style.transform = `rotate(${sway.angle.toFixed(3)}deg)`;
          }
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  // Wheel & Keyboard listeners
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (qvOpenRef.current) return;
      const target = e.target as HTMLElement | null;
      if (cartOpenRef.current && target?.closest('.drawer-items')) {
        return;
      }
      e.preventDefault();
      const dominant =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const params = getRailParams(vpWidthRef.current);
      const pageW = pageRef.current?.clientWidth || vpWidthRef.current;
      const maxScroll = computeMaxScroll(
        params.start,
        params.gap,
        RAIL_ORDER.length,
        uRef.current,
        pageW
      );
      targetScrollRef.current = clamp(
        targetScrollRef.current + dominant * 0.9,
        0,
        maxScroll
      );
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  const closeQuickView = useCallback(() => {
    if (!qvOpenRef.current) return;
    const token = ++qvTokenRef.current;
    if (addTimerRef.current !== null) {
      window.clearTimeout(addTimerRef.current);
      addTimerRef.current = null;
    }
    setIsAdding(false);

    const activeQv = qvItem;
    if (!activeQv) return;

    document.body.classList.remove('qv-open');

    if (reducedMotionRef.current || !qvImgRef.current) {
      qvAnimRef.current?.cancel();
      setQvItem(null);
      setHiddenRailIndex(null);
      return;
    }

    const railFaceEl = sideFaceElsRef.current[activeQv.index];
    const qvImgEl = qvImgRef.current;
    const curU = uRef.current;
    const vpW = vpWidthRef.current;
    const vpH = window.innerHeight;
    const params = getRailParams(vpW);
    const isDesktop = vpW > 820;

    let qvHookX = 440 * curU;
    let qvHookY = 62 * curU;
    let qvScale = 0.9 * curU;
    if (!isDesktop) {
      qvHookX = vpW / 2;
      qvHookY = 64 * curU;
      const infoH = qvInfoRef.current?.offsetHeight || 280 * curU;
      const availH = Math.max(160 * curU, vpH - qvHookY - infoH - 36 * curU);
      qvScale = computeMobileQvScale(
        activeQv.garment.crops.front.h,
        activeQv.garment.crops.back.h,
        availH,
        curU
      );
    }

    if (!railFaceEl) {
      setQvItem(null);
      setHiddenRailIndex(null);
      return;
    }

    const dstRect = railFaceEl.getBoundingClientRect();
    const qvFrontH = (activeQv.garment.crops.front.h + 6) * qvScale;
    const endScale = dstRect.height > 0 ? dstRect.height / qvFrontH : params.gs * curU / qvScale;
    const dx = dstRect.left - qvHookX + 170 * qvScale * endScale;
    const dy = dstRect.top - qvHookY;

    qvAnimRef.current?.cancel();
    const anim = qvImgEl.animate(
      [
        {
          transform: 'translate3d(0px, 0px, 0px) scale(1)',
          opacity: 1,
        },
        {
          transform: `translate3d(${dx}px, ${dy}px, 0px) scale(${endScale})`,
          opacity: 0,
        },
      ],
      {
        duration: 520,
        easing: 'cubic-bezier(0.55, 0, 0.2, 1)',
        fill: 'forwards',
      }
    );
    qvAnimRef.current = anim;

    anim.onfinish = () => {
      if (token !== qvTokenRef.current) return;
      qvAnimRef.current = null;
      setQvItem(null);
      setHiddenRailIndex(null);
    };
  }, [qvItem]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (qvOpenRef.current) {
          closeQuickView();
        } else if (cartOpenRef.current) {
          setCartOpen(false);
        }
        return;
      }

      if (qvOpenRef.current) return;

      const params = getRailParams(vpWidthRef.current);
      const pageW = pageRef.current?.clientWidth || vpWidthRef.current;
      const maxScroll = computeMaxScroll(
        params.start,
        params.gap,
        RAIL_ORDER.length,
        uRef.current,
        pageW
      );
      if (e.key === 'ArrowRight') {
        targetScrollRef.current = clamp(
          targetScrollRef.current + params.gap * uRef.current,
          0,
          maxScroll
        );
      } else if (e.key === 'ArrowLeft') {
        targetScrollRef.current = clamp(
          targetScrollRef.current - params.gap * uRef.current,
          0,
          maxScroll
        );
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeQuickView]);

  // Pointer drag on rail zone
  const handleRailPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (qvOpenRef.current) return;

      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startTarget = targetScrollRef.current;
      let lastX = e.clientX;
      let lastTime = performance.now();
      let vel = 0;
      let dragging = false;

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const dx = ev.clientX - startX;
        if (!dragging && Math.abs(dx) > 6) {
          dragging = true;
          isDraggingRef.current = true;
          railZoneRef.current?.classList.add('is-dragging');
          setHoveredIdx(null);
        }
        if (!dragging) return;

        const now = performance.now();
        const elapsed = Math.max(1, now - lastTime);
        const instVel = (ev.clientX - lastX) / elapsed;
        vel = vel * 0.4 + instVel * 0.6;
        lastX = ev.clientX;
        lastTime = now;

        const params = getRailParams(vpWidthRef.current);
        const pageW = pageRef.current?.clientWidth || vpWidthRef.current;
        const maxScroll = computeMaxScroll(
          params.start,
          params.gap,
          RAIL_ORDER.length,
          uRef.current,
          pageW
        );
        targetScrollRef.current = clamp(startTarget - dx * 1.15, 0, maxScroll);
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);

        if (dragging) {
          dragging = false;
          isDraggingRef.current = false;
          railZoneRef.current?.classList.remove('is-dragging');
          suppressClickUntilRef.current = performance.now() + 80;

          const params = getRailParams(vpWidthRef.current);
          const pageW = pageRef.current?.clientWidth || vpWidthRef.current;
          const maxScroll = computeMaxScroll(
            params.start,
            params.gap,
            RAIL_ORDER.length,
            uRef.current,
            pageW
          );
          targetScrollRef.current = clamp(
            targetScrollRef.current - vel * 260,
            0,
            maxScroll
          );
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    []
  );

  const openQuickView = useCallback(
    (index: number) => {
      if (suppressClickUntilRef.current > performance.now()) return;
      if (isAddingRef.current) return;

      if (isTouch && hoveredIdxRef.current !== index) {
        setHoveredIdx(index);
        return;
      }

      const token = ++qvTokenRef.current;
      qvAnimRef.current?.cancel();
      qvAnimRef.current = null;

      const k = RAIL_ORDER[index];
      const garment = GARMENTS[k];
      const wasHovered = hoveredIdxRef.current === index;
      const srcFaceEl = wasHovered
        ? frontFaceElsRef.current[index]
        : sideFaceElsRef.current[index];
      const srcRect = srcFaceEl?.getBoundingClientRect();

      setHoveredIdx(null);
      setHiddenRailIndex(index);
      setQvView('front');
      setQvSize('S');
      setIsAdding(false);
      setQvItem({ index, k, garment });

      if (!srcRect || reducedMotionRef.current) return;

      requestAnimationFrame(() => {
        if (token !== qvTokenRef.current) return;
        const qvImgEl = qvImgRef.current;
        if (!qvImgEl) return;

        const curU = uRef.current;
        const vpW = vpWidthRef.current;
        const vpH = window.innerHeight;
        const isDesktop = vpW > 820;

        let qvHookX = 440 * curU;
        let qvHookY = 62 * curU;
        let qvScale = 0.9 * curU;
        if (!isDesktop) {
          qvHookX = vpW / 2;
          qvHookY = 64 * curU;
          const infoH = qvInfoRef.current?.offsetHeight || 280 * curU;
          const availH = Math.max(
            160 * curU,
            vpH - qvHookY - infoH - 36 * curU
          );
          qvScale = computeMobileQvScale(
            garment.crops.front.h,
            garment.crops.back.h,
            availH,
            curU
          );
        }

        const targetH = (garment.crops.front.h + 6) * qvScale;
        const startScale = targetH > 0 ? srcRect.height / targetH : 0.5;
        const dx = srcRect.left - qvHookX + 170 * qvScale * startScale;
        const dy = srcRect.top - qvHookY;

        const anim = qvImgEl.animate(
          [
            {
              transform: `translate3d(${dx}px, ${dy}px, 0px) scale(${startScale})`,
              opacity: 0.6,
            },
            {
              transform: 'translate3d(0px, 0px, 0px) scale(1)',
              opacity: 1,
            },
          ],
          {
            duration: 700,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'forwards',
          }
        );
        qvAnimRef.current = anim;
        anim.onfinish = () => {
          if (token !== qvTokenRef.current) return;
          qvAnimRef.current = null;
          qvImgEl.style.transform = '';
          qvImgEl.style.opacity = '';
        };
      });
    },
    [isTouch]
  );

  const handleSelectQvTab = useCallback(async (view: GarmentView) => {
    const token = qvTokenRef.current;
    if (view === 'back' && sheetPromisesRef.current) {
      await sheetPromisesRef.current.back;
      if (token !== qvTokenRef.current || !qvOpenRef.current) return;
    }
    setQvView(view);
  }, []);

  const handleAddToCart = useCallback(() => {
    if (!qvItem || isAddingRef.current) return;
    const capturedItem = qvItem;
    const capturedSize = qvSize;
    const capturedView = qvView;
    const token = qvTokenRef.current;

    setIsAdding(true);

    const waitMs = reducedMotionRef.current ? 0 : 1000;
    addTimerRef.current = window.setTimeout(() => {
      addTimerRef.current = null;
      if (token !== qvTokenRef.current || !qvOpenRef.current) return;

      const activeFaceEl =
        capturedView === 'back'
          ? qvBackFaceRef.current
          : qvFrontFaceRef.current;
      const faceRect = activeFaceEl?.getBoundingClientRect();
      const bagRect = bagBtnRef.current?.getBoundingClientRect();

      // Capture styles before unmounting qvItem
      const bgImg = activeFaceEl?.style.backgroundImage || '';
      const bgSize = activeFaceEl?.style.backgroundSize || '';
      const bgPos = activeFaceEl?.style.backgroundPosition || '';

      // Close quick-view without return flight
      qvAnimRef.current?.cancel();
      qvAnimRef.current = null;
      document.body.classList.remove('qv-open');
      setQvItem(null);
      setHiddenRailIndex(null);
      setIsAdding(false);

      if (reducedMotionRef.current || !faceRect || !bagRect) {
        setCart((prev) => addItemToCart(prev, capturedItem.garment, capturedSize));
        return;
      }

      // Drop garment back onto its rail hook with a gentle swing nudge
      const dropEl = dropElsRef.current[capturedItem.index];
      const curU = uRef.current;
      if (dropEl) {
        dropEl.animate(
          [
            { transform: `translateY(${-24 * curU}px)`, opacity: 0 },
            { transform: 'translateY(0px)', opacity: 1 },
          ],
          {
            duration: 520,
            delay: 260,
            easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
            fill: 'backwards',
          }
        );
      }
      swayVelRef.current[capturedItem.index] += 1.4;

      // Create fly-to-bag clone
      const clone = document.createElement('div');
      clone.className = 'fly-clone';
      clone.style.left = `${faceRect.left}px`;
      clone.style.top = `${faceRect.top}px`;
      clone.style.width = `${faceRect.width}px`;
      clone.style.height = `${faceRect.height}px`;
      clone.style.backgroundImage = bgImg;
      clone.style.backgroundSize = bgSize;
      clone.style.backgroundPosition = bgPos;
      document.body.appendChild(clone);

      const bagCenterX = bagRect.left + bagRect.width / 2;
      const bagCenterY = bagRect.top + bagRect.height / 2;
      const originX = faceRect.left + faceRect.width * 0.5;
      const originY = faceRect.top + faceRect.height * 0.42;
      const tx = bagCenterX - originX;
      const ty = bagCenterY - originY;
      const endScale = Math.max(0.04, (bagRect.height * 1.6) / faceRect.height);
      const midScale = (1 + endScale) * 0.42;

      const flyAnim = clone.animate(
        [
          {
            transform: 'translate3d(0px, 0px, 0px) scale(1)',
            opacity: 1,
          },
          {
            transform: `translate3d(${tx * 0.45}px, ${ty * 0.45 - 90 * curU}px, 0px) scale(${midScale})`,
            opacity: 0.9,
            offset: 0.45,
          },
          {
            transform: `translate3d(${tx}px, ${ty}px, 0px) scale(${endScale})`,
            opacity: 0.35,
          },
        ],
        {
          duration: 820,
          easing: 'cubic-bezier(0.55, 0.05, 0.35, 1)',
          fill: 'forwards',
        }
      );

      flyAnim.onfinish = () => {
        clone.remove();
        setCart((prev) => addItemToCart(prev, capturedItem.garment, capturedSize));

        if (bagBadgeRef.current) {
          bagBadgeRef.current.animate(
            [
              { transform: 'scale(1)' },
              { transform: 'scale(1.45)', offset: 0.45 },
              { transform: 'scale(1)' },
            ],
            {
              duration: 500,
              easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)',
            }
          );
        }

        if (bagBtnRef.current) {
          bagBtnRef.current.animate(
            [
              { transform: 'scale(1) rotate(0deg)' },
              { transform: 'scale(1.22) rotate(-6deg)', offset: 0.38 },
              { transform: 'scale(0.94) rotate(0deg)', offset: 0.72 },
              { transform: 'scale(1) rotate(0deg)' },
            ],
            {
              duration: 520,
              easing: 'ease-out',
            }
          );
        }
      };
    }, waitMs);
  }, [qvItem, qvSize, qvView]);

  const params = useMemo(() => getRailParams(viewportWidth), [viewportWidth]);
  const garmentScale = params.gs * u;
  const { count: cartCount, total: cartTotal } = useMemo(
    () => computeCartTotals(cart),
    [cart]
  );

  // Quick-view layout geometry
  const qvGeometry = useMemo(() => {
    if (!qvItem) return null;
    const isDesktop = viewportWidth > 820;
    let hookX = 440 * u;
    let hookY = 62 * u;
    let qvScale = 0.9 * u;

    if (!isDesktop) {
      hookX = viewportWidth / 2;
      hookY = 64 * u;
      const availH = Math.max(160 * u, viewportHeight - hookY - 310 * u);
      qvScale = computeMobileQvScale(
        qvItem.garment.crops.front.h,
        qvItem.garment.crops.back.h,
        availH,
        u
      );
    }

    const frontCrop = computeCropLayout(qvItem.garment.crops.front, qvScale);
    const backCrop = computeCropLayout(qvItem.garment.crops.back, qvScale);

    return {
      hookX,
      hookY,
      frontCrop,
      backCrop,
    };
  }, [qvItem, viewportWidth, viewportHeight, u]);

  const hoveredGarment =
    hoveredIdx !== null ? GARMENTS[RAIL_ORDER[hoveredIdx]] : null;

  return (
    <>
      <div className="page" ref={pageRef}>
        <main className="stage" aria-label="Maison Verrel — The Rail">
          {/* Utility Bar */}
          <div className="util-bar">
            <a href="#ateliers" onClick={(e) => e.preventDefault()}>
              Our Ateliers
            </a>
            <a href="#care" onClick={(e) => e.preventDefault()}>
              Care
            </a>
            <a href="#journal" onClick={(e) => e.preventDefault()}>
              Journal
            </a>
            <a href="#sign-in" onClick={(e) => e.preventDefault()}>
              Sign In
            </a>
          </div>

          {/* Navigation Row */}
          <header className="nav-row">
            <a
              href="#top"
              className="wordmark"
              onClick={(e) => e.preventDefault()}
            >
              MAISON VERREL
            </a>

            <nav className="nav-links" aria-label="Primary navigation">
              <a href="#home" onClick={(e) => e.preventDefault()}>
                Home
              </a>
              <a href="#atelier" onClick={(e) => e.preventDefault()}>
                Atelier
              </a>
              <a href="#the-rail" onClick={(e) => e.preventDefault()}>
                The Rail
              </a>
              <a href="#contact" onClick={(e) => e.preventDefault()}>
                Contact
              </a>
            </nav>

            <div className="tools">
              <button
                type="button"
                className="search-pill"
                aria-label="Search collection"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle
                    cx="10.5"
                    cy="10.5"
                    r="7"
                    stroke="#2A2420"
                    strokeWidth="1.7"
                  />
                  <line
                    x1="15.8"
                    y1="15.8"
                    x2="21"
                    y2="21"
                    stroke="#2A2420"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="search-label">Search</span>
              </button>

              <button
                type="button"
                className="account-btn"
                aria-label="Account"
              >
                <svg viewBox="0 0 22 22" fill="none" aria-hidden="true">
                  <circle
                    cx="11"
                    cy="7"
                    r="4"
                    stroke="#1A1716"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M3.5 19.5C3.5 15.8 6.85 13.5 11 13.5C15.15 13.5 18.5 15.8 18.5 19.5"
                    stroke="#1A1716"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              <button
                type="button"
                ref={bagBtnRef}
                className="bag-btn"
                aria-label={`Shopping bag, ${cartCount} items`}
                aria-expanded={cartOpen}
                onClick={() => setCartOpen((prev) => !prev)}
              >
                <svg viewBox="0 0 22 22" fill="none" aria-hidden="true">
                  <path
                    d="M4.2 7.5H17.8L19.1 19.5H2.9L4.2 7.5Z"
                    stroke="#1A1716"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M7.5 7.5V6C7.5 4.07 9.07 2.5 11 2.5C12.93 2.5 14.5 4.07 14.5 6V7.5"
                    stroke="#1A1716"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                <span
                  ref={bagBadgeRef}
                  className="bag-badge"
                  data-testid="bag-badge"
                >
                  {cartCount}
                </span>
              </button>
            </div>
          </header>

          {/* Hero Eyebrow & Headline */}
          <div className="eyebrow">
            <span className="eyebrow-left">NEW COLLECTION</span>
            <span className="eyebrow-div" aria-hidden="true" />
            <span className="eyebrow-right">EVENING &amp; TAILORING</span>
          </div>

          <h1 className="headline">
            {['Silhouettes', 'that', 'hang', 'right.'].map((word, j) => (
              <span
                key={word}
                ref={(el) => {
                  wordElsRef.current[j] = el;
                }}
                className={`headline-word hw-${j}`}
              >
                {word}
              </span>
            ))}
          </h1>

          {/* Curved Gold Rail SVG */}
          <svg
            className="rail-svg"
            aria-hidden="true"
            data-testid="rail-svg"
          >
            <defs>
              <linearGradient id="railGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E9DCBC" />
                <stop offset="45%" stopColor="#C2A877" />
                <stop offset="100%" stopColor="#7F6743" />
              </linearGradient>
            </defs>
            <path
              ref={railShadowPathRef}
              fill="none"
              stroke="rgba(80,60,35,0.12)"
              strokeLinecap="round"
            />
            <path
              ref={railMainPathRef}
              fill="none"
              stroke="url(#railGrad)"
              strokeLinecap="round"
            />
            <path
              ref={railHighlightPathRef}
              fill="none"
              stroke="rgba(255,247,226,0.85)"
              strokeLinecap="round"
            />
          </svg>

          {/* Interactive Garments on the Rail */}
          <div
            ref={railZoneRef}
            className="rail-zone"
            data-testid="rail-zone"
            onPointerDown={handleRailPointerDown}
          >
            <div className="garments">
              {RAIL_ORDER.map((k, i) => {
                const g = GARMENTS[k];
                const sideLayout = computeCropLayout(
                  g.crops.side,
                  garmentScale
                );
                const frontLayout = computeCropLayout(
                  g.crops.front,
                  garmentScale
                );
                const shadowWidth = 110 * (params.gs / 0.48) * u;
                const shadowTop = sideLayout.height + 4 * u;
                const tagRot = TAG_ROTATIONS[i % TAG_ROTATIONS.length];
                const isHov = hoveredIdx === i;
                const isHidden = hiddenRailIndex === i;

                return (
                  <div
                    key={i}
                    ref={(el) => {
                      garmentElsRef.current[i] = el;
                    }}
                    className={`g${isHov ? ' hov' : ''}${isHidden ? ' is-hidden' : ''}`}
                    data-garment-index={i}
                    data-garment-k={k}
                  >
                    <div
                      ref={(el) => {
                        dropElsRef.current[i] = el;
                      }}
                      className="drop"
                    >
                      <div
                        ref={(el) => {
                          swayElsRef.current[i] = el;
                        }}
                        className="sway"
                      >
                        <div className="lift">
                          <div
                            ref={(el) => {
                              sideFaceElsRef.current[i] = el;
                            }}
                            className="face face-side"
                            style={{
                              width: `${sideLayout.width}px`,
                              height: `${sideLayout.height}px`,
                              left: `${sideLayout.left}px`,
                              backgroundImage: `url("${SHEET_URLS.side}")`,
                              backgroundSize: `${sideLayout.bgWidth}px auto`,
                              backgroundPosition: `${sideLayout.bgPosX}px ${sideLayout.bgPosY}px`,
                            }}
                          />
                          <div
                            ref={(el) => {
                              frontFaceElsRef.current[i] = el;
                            }}
                            className="face face-front"
                            style={{
                              width: `${frontLayout.width}px`,
                              height: `${frontLayout.height}px`,
                              left: `${frontLayout.left}px`,
                              backgroundImage: `url("${SHEET_URLS.front}")`,
                              backgroundSize: `${frontLayout.bgWidth}px auto`,
                              backgroundPosition: `${frontLayout.bgPosX}px ${frontLayout.bgPosY}px`,
                            }}
                          />
                          <div
                            className="tag"
                            style={
                              {
                                '--tag-rot': `${tagRot}deg`,
                              } as React.CSSProperties
                            }
                            aria-hidden="true"
                          >
                            ${g.price}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className="g-shadow"
                      style={{
                        width: `${shadowWidth}px`,
                        top: `${shadowTop}px`,
                      }}
                      aria-hidden="true"
                    />

                    <button
                      type="button"
                      className="hit"
                      style={{
                        width: `${params.gap * u}px`,
                        height: `${sideLayout.height}px`,
                      }}
                      aria-label={`${g.name}, $${g.price}`}
                      onPointerEnter={(e) => {
                        if (
                          e.pointerType === 'mouse' &&
                          !isDraggingRef.current &&
                          !isAddingRef.current &&
                          !qvOpenRef.current
                        ) {
                          setHoveredIdx(i);
                        }
                      }}
                      onPointerLeave={(e) => {
                        if (e.pointerType === 'mouse') {
                          setHoveredIdx((prev) => (prev === i ? null : prev));
                        }
                      }}
                      onClick={() => openQuickView(i)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Left: Hint & Hover Label */}
          <div
            ref={footerLeftRef}
            className={`footer-left${hoveredGarment ? ' has-hover' : ''}`}
          >
            <div className="hint">
              <span className="hint-rule" aria-hidden="true" />
              <span>
                {isTouch
                  ? 'Tap a piece · tap again to look closer'
                  : 'Hover a piece · click to look closer'}
              </span>
            </div>
            <div className="hover-label" aria-live="polite">
              {hoveredGarment && (
                <>
                  <div className="hover-label-name">{hoveredGarment.name}</div>
                  <div className="hover-label-price">
                    {formatCurrency(hoveredGarment.price)}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Footer Center: Scroll Progress */}
          <div ref={progressElRef} className="progress" aria-hidden="true">
            <div ref={progressThumbRef} className="progress-thumb" />
          </div>

          {/* Footer Right: Copy & CTA */}
          <div ref={footerRightRef} className="footer-right">
            <p className="footer-copy">
              Cut from Italian silk and wool.
              <br />
              Tailored to order. Made to last.
            </p>
            <a
              href="#collection"
              className="shop-link"
              onClick={(e) => {
                e.preventDefault();
                openQuickView(0);
              }}
            >
              <span>Shop the Collection</span>
              <svg viewBox="0 0 15 10" fill="none" aria-hidden="true">
                <line
                  x1="0"
                  y1="5"
                  x2="13.5"
                  y2="5"
                  stroke="#1A1716"
                  strokeWidth="1.3"
                />
                <path
                  d="M9.5 1L13.8 5L9.5 9"
                  stroke="#1A1716"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </main>

        {/* Quick-View Layer */}
        <section
          className="qv"
          data-view={qvView}
          aria-hidden={qvItem === null}
          aria-label={qvItem ? qvItem.garment.name : 'Quick view'}
        >
          {qvItem && qvGeometry && (
            <>
              <div
                className="qv-rod"
                style={{
                  left: `${qvGeometry.hookX}px`,
                  height: `${qvGeometry.hookY + 4 * u}px`,
                }}
                aria-hidden="true"
              />

              <div
                ref={qvImgRef}
                className="qv-img"
                style={{
                  left: `${qvGeometry.hookX}px`,
                  top: `${qvGeometry.hookY}px`,
                }}
              >
                <div
                  ref={qvFrontFaceRef}
                  className="qv-face qv-face-front"
                  style={{
                    width: `${qvGeometry.frontCrop.width}px`,
                    height: `${qvGeometry.frontCrop.height}px`,
                    left: `${qvGeometry.frontCrop.left}px`,
                    backgroundImage: `url("${SHEET_URLS.front}")`,
                    backgroundSize: `${qvGeometry.frontCrop.bgWidth}px auto`,
                    backgroundPosition: `${qvGeometry.frontCrop.bgPosX}px ${qvGeometry.frontCrop.bgPosY}px`,
                  }}
                />
                <div
                  ref={qvBackFaceRef}
                  className="qv-face qv-face-back"
                  style={{
                    width: `${qvGeometry.backCrop.width}px`,
                    height: `${qvGeometry.backCrop.height}px`,
                    left: `${qvGeometry.backCrop.left}px`,
                    backgroundImage: `url("${SHEET_URLS.back}")`,
                    backgroundSize: `${qvGeometry.backCrop.bgWidth}px auto`,
                    backgroundPosition: `${qvGeometry.backCrop.bgPosX}px ${qvGeometry.backCrop.bgPosY}px`,
                  }}
                />
              </div>

              <div ref={qvInfoRef} className="qv-info">
                <div className="qv-counter qv-stagger qv-stagger-0">
                  {qvItem.index + 1} / {RAIL_ORDER.length}
                </div>
                <h2 className="qv-name qv-stagger qv-stagger-1">
                  {qvItem.garment.name}
                </h2>
                <div className="qv-price qv-stagger qv-stagger-2">
                  {formatCurrency(qvItem.garment.price)}
                </div>

                <div
                  className="qv-tabs qv-stagger qv-stagger-3"
                  role="tablist"
                  aria-label="Garment angle"
                >
                  <button
                    type="button"
                    role="tab"
                    className="qv-tab"
                    aria-selected={qvView === 'front'}
                    onClick={() => handleSelectQvTab('front')}
                  >
                    Front
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className="qv-tab"
                    aria-selected={qvView === 'back'}
                    onClick={() => handleSelectQvTab('back')}
                  >
                    Back
                  </button>
                </div>

                <div className="qv-size-label qv-stagger qv-stagger-4">
                  SIZE
                </div>
                <div
                  className="qv-sizes qv-stagger qv-stagger-5"
                  role="group"
                  aria-label="Select size"
                >
                  {SIZES.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      className="qv-size-pill"
                      aria-pressed={qvSize === sz}
                      onClick={() => setQvSize(sz)}
                    >
                      {sz}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className={`qv-add-btn qv-stagger qv-stagger-6${isAdding ? ' is-adding' : ''}`}
                  disabled={isAdding}
                  onClick={handleAddToCart}
                >
                  {isAdding ? (
                    <>
                      <span className="qv-spinner" aria-hidden="true" />
                      <span>Adding…</span>
                    </>
                  ) : (
                    'Add to cart'
                  )}
                </button>

                <div className="qv-meta qv-stagger qv-stagger-7">
                  <span>{qvItem.garment.name}</span>
                  <a
                    href="#product"
                    className="qv-meta-link"
                    onClick={(e) => e.preventDefault()}
                  >
                    View product page
                  </a>
                </div>
              </div>

              <button
                type="button"
                className="qv-close"
                aria-label="Close quick view"
                onClick={closeQuickView}
              >
                <span>Close</span>
                <span aria-hidden="true">×</span>
              </button>
            </>
          )}
        </section>
      </div>

      {/* Cart Drawer */}
      <aside
        className="drawer"
        aria-label="Shopping cart"
        aria-hidden={!cartOpen}
      >
        <div className="drawer-header">
          <div className="drawer-title-group">
            <h2 className="drawer-title">Cart</h2>
            <span className="drawer-count" data-testid="drawer-count">
              {cartCount}
            </span>
          </div>
          <button
            type="button"
            className="drawer-close"
            aria-label="Close cart"
            onClick={() => setCartOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="drawer-items">
          {cart.length === 0 ? (
            <div className="drawer-empty">Your bag is currently empty.</div>
          ) : (
            cart.map((item) => {
              const garment = GARMENTS[item.k];
              const crop = garment.crops.front;
              const thumbScale = (82 * u) / (crop.h + 6);
              const thumbLayout = computeCropLayout(crop, thumbScale);

              return (
                <div
                  key={item.id}
                  className={`cart-row${item.isNew ? ' is-new' : ''}`}
                >
                  <div className="cart-thumb">
                    <div
                      className="cart-thumb-crop"
                      style={{
                        width: `${thumbLayout.width}px`,
                        height: `${thumbLayout.height}px`,
                        backgroundImage: `url("${SHEET_URLS.front}")`,
                        backgroundSize: `${thumbLayout.bgWidth}px auto`,
                        backgroundPosition: `${thumbLayout.bgPosX}px ${thumbLayout.bgPosY}px`,
                      }}
                    />
                  </div>

                  <div>
                    <div className="cart-row-name">{item.name}</div>
                    <div className="cart-row-meta">
                      Size {item.size} · {formatCurrency(item.price)}
                    </div>
                    <div className="cart-row-actions">
                      <div className="stepper">
                        <button
                          type="button"
                          aria-label={`Decrease quantity of ${item.name} (${item.size})`}
                          onClick={() =>
                            setCart((prev) => updateCartQty(prev, item.id, -1))
                          }
                        >
                          −
                        </button>
                        <span className="stepper-val">{item.qty}</span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${item.name} (${item.size})`}
                          onClick={() =>
                            setCart((prev) => updateCartQty(prev, item.id, 1))
                          }
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        className="trash-btn"
                        aria-label={`Remove ${item.name} (${item.size})`}
                        onClick={() =>
                          setCart((prev) => removeCartItem(prev, item.id))
                        }
                      >
                        <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
                          <path
                            d="M3 5H15M6.5 5V3.5C6.5 2.95 6.95 2.5 7.5 2.5H10.5C11.05 2.5 11.5 2.95 11.5 3.5V5M5 5L5.7 14.5C5.75 15.05 6.2 15.5 6.75 15.5H11.25C11.8 15.5 12.25 15.05 12.3 14.5L13 5"
                            stroke="currentColor"
                            strokeWidth="1.35"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="cart-row-total">
                    {formatCurrency(item.price * item.qty)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="drawer-footer">
          <div className="drawer-total-row">
            <span className="drawer-total-label">Estimated total</span>
            <span className="drawer-total-value" data-testid="drawer-total">
              {formatCurrency(cartTotal)}
            </span>
          </div>
          <p className="drawer-note">
            Taxes and shipping calculated at checkout.
          </p>
          <button type="button" className="checkout-btn">
            Checkout
          </button>
        </div>
      </aside>
    </>
  );
}
