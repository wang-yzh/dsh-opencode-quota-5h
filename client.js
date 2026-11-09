/**
 * dsh-opencode-quota-5h:OpenCode Go 用量状态条(Client 半)。
 *
 * 并入 Harness 官方输入框下方的底栏状态行(`conversation.composer.dock`),
 * 以最小 order 排在最左,和官方「会话统计 / Token 用量 / 上下文」药丸并排。
 * 药丸只显示 5 小时窗口的已用百分比;点击药丸展开的官方 StatDialog 风格
 * 详情浮层仍展示全部窗口的已用 / 剩余 / 重置时间,可手动刷新,也可打开
 * OpenCode Console。
 *
 * 数据来自同源 GET /opencode-quota/stats(Host 半缓存),每 60 秒刷新,
 * 页面重新可见时立即刷新。视觉上复制官方药丸与统计弹层的结构与 token,
 * 不依赖 ui-primitives。
 */
window.__ModuleLoader__.load({
  id: "dsh-opencode-quota-5h",
  factory(require) {
    const React = require("react");
    const h = React.createElement;
    let createPortal = null;
    try {
      createPortal = require("react-dom").createPortal;
    } catch (_error) {
      createPortal = null;
    }

    const NS = "opencode-quota";
    const ROUTE = "/opencode-quota/stats";
    const CONSOLE_URL = "https://opencode.ai/console";
    const REFRESH_MS = 60_000;
    const ORDER = -10;
    const PERIOD_KEYS = ["rolling", "weekly", "monthly"];
    // 药丸只展示 5 小时(rolling)窗口;详情浮层仍按 PERIOD_KEYS 展示全部窗口。
    const PILL_PERIOD_KEYS = ["rolling"];
    const PANEL_MARGIN = 12;
    const PANEL_GAP = 8;

    const zh = {
      label: "OpenCode Go 额度",
      rolling: "5小时",
      weekly: "每周",
      monthly: "每月",
      used: "已用",
      remaining: "剩余",
      resets: "重置",
      updated: "更新于",
      loading: "正在读取 OpenCode 额度…",
      unavailable: "OpenCode 额度读取失败",
      retry: "点击重试",
      notConfigured: "未配置 OPENCODE_GO_API_KEY",
      refresh: "刷新",
      console: "OpenCode Console",
      close: "关闭",
    };
    const en = {
      label: "OpenCode Go quota",
      rolling: "5-hour",
      weekly: "Weekly",
      monthly: "Monthly",
      used: "Used",
      remaining: "Remaining",
      resets: "Resets",
      updated: "Updated",
      loading: "Reading OpenCode quota…",
      unavailable: "OpenCode quota unavailable",
      retry: "Click to retry",
      notConfigured: "OPENCODE_GO_API_KEY is not configured",
      refresh: "Refresh",
      console: "OpenCode Console",
      close: "Close",
    };

    // 官方 StatsPills 药丸 + StatDialog 弹层的同等样式,类名前缀改为 ocq_。
    const CSS = [
      ".ocq_anchor{min-width:0;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));display:inline-flex}",
      ".ocq_pill{box-sizing:border-box;border-radius:var(--dsw-radius-sm);max-width:100%;color:var(--dsw-alias-label-tertiary);font:inherit;font-variant-numeric:tabular-nums;line-height:inherit;white-space:nowrap;background:0 0;border:none;align-items:center;gap:6px;padding:1px 8px;display:inline-flex;cursor:pointer}",
      ".ocq_pill svg{flex:none;width:14px;height:14px}",
      ".ocq_pill[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}",
      "@media (hover:hover){.ocq_pill:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}}",
      ".ocq_label{text-overflow:ellipsis;min-width:0;overflow:hidden}",
      ".ocq_sep{color:var(--dsw-alias-separator-primary);margin:0 5px}",
      ".ocq_warn{color:var(--dsw-alias-state-warn-primary)}",
      ".ocq_error{color:var(--dsw-alias-state-error-primary)}",
      ".ocq_panel{z-index:1100;box-sizing:border-box;width:320px;max-width:calc(100vw - 24px);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-overlay);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);border:.5px solid var(--dsw-alias-border-l1);padding:14px;font-size:12px;line-height:18px;position:fixed;overflow:hidden auto}",
      ".ocq_panelTitle{color:var(--dsw-alias-label-primary);justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;font-weight:500;display:flex}",
      ".ocq_panelTitleLabel{align-items:center;gap:6px;min-width:0;display:inline-flex}",
      ".ocq_panelTitleLabel svg{flex:none;width:14px;height:14px}",
      ".ocq_panelTitleValue{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;font-weight:400;white-space:nowrap}",
      ".ocq_rule{border-top:.5px solid var(--dsw-alias-border-l2);margin:0 0 10px}",
      ".ocq_row+.ocq_row{margin-top:10px}",
      ".ocq_rowHead{align-items:baseline;gap:8px;display:flex}",
      ".ocq_rowName{color:var(--dsw-alias-label-primary);font-weight:500;flex:none}",
      ".ocq_rowUsed{font-variant-numeric:tabular-nums;flex:none}",
      ".ocq_rowRemaining{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex:none}",
      ".ocq_rowReset{color:var(--dsw-alias-label-tertiary);margin-top:2px;font-variant-numeric:tabular-nums}",
      ".ocq_bar{height:4px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);margin-top:4px;overflow:hidden}",
      ".ocq_barFill{height:100%;border-radius:999px;min-width:2px}",
      ".ocq_message{color:var(--dsw-alias-label-tertiary);padding:4px 0}",
      ".ocq_footer{border-top:.5px solid var(--dsw-alias-border-l2);margin-top:12px;padding-top:8px;align-items:center;gap:12px;display:flex;justify-content:space-between}",
      ".ocq_action{color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:var(--dsw-radius-sm);cursor:pointer;font:inherit;padding:1px 6px;text-decoration:none;display:inline-flex;align-items:center;gap:4px}",
      "@media (hover:hover){.ocq_action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}}",
      ".ocq_action:disabled{opacity:.5;cursor:default}",
    ].join("");

    const GaugeIcon = (props) =>
      h(
        "svg",
        { viewBox: "0 0 16 16", "aria-hidden": true, fill: "none", ...props },
        h("path", {
          d: "M2.5 11.5a5.5 5.5 0 0 1 11 0",
          stroke: "currentColor",
          strokeWidth: "1.5",
          strokeLinecap: "round",
        }),
        h("path", {
          d: "M8 11.5 10.2 8.4",
          stroke: "currentColor",
          strokeWidth: "1.5",
          strokeLinecap: "round",
        }),
        h("circle", { cx: "8", cy: "11.5", r: "1.35", fill: "currentColor" }),
      );

    function percentColor(percent) {
      if (percent >= 85) return "var(--dsw-alias-state-error-primary)";
      if (percent >= 60) return "var(--dsw-alias-state-warn-primary)";
      return "var(--dsw-alias-state-success-primary)";
    }

    function formatReset(value) {
      if (typeof value !== "string" || value.length === 0) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      try {
        return date.toLocaleString();
      } catch (_error) {
        return value;
      }
    }

    function formatClock(timestamp) {
      if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return "";
      try {
        return new Date(timestamp).toLocaleTimeString();
      } catch (_error) {
        return "";
      }
    }

    function buildTitle(t, periods) {
      if (!periods) return t("label");
      const parts = [t("label")];
      for (const key of PILL_PERIOD_KEYS) {
        const period = periods[key];
        if (!period) continue;
        parts.push(`${t(key)} ${t("used")} ${period.percent}%`);
      }
      return parts.join("  ·  ");
    }

    /** Trigger-anchored placement: above the pill, clamped into the viewport. */
    function useAnchoredPosition(open, anchorRef, panelRef) {
      const [pos, setPos] = React.useState(null);
      React.useLayoutEffect(() => {
        if (!open) {
          setPos(null);
          return;
        }
        const place = () => {
          const anchor = anchorRef.current;
          const panel = panelRef.current;
          if (!anchor || !panel) return;
          const a = anchor.getBoundingClientRect();
          const p = panel.getBoundingClientRect();
          const maxLeft = Math.max(PANEL_MARGIN, window.innerWidth - p.width - PANEL_MARGIN);
          const left = Math.min(Math.max(a.left, PANEL_MARGIN), maxLeft);
          let top = a.top - p.height - PANEL_GAP;
          if (top < PANEL_MARGIN) top = a.bottom + PANEL_GAP;
          setPos({ left, top });
        };
        place();
        window.addEventListener("resize", place);
        window.addEventListener("scroll", place, true);
        return () => {
          window.removeEventListener("resize", place);
          window.removeEventListener("scroll", place, true);
        };
      }, [open, anchorRef, panelRef]);
      return pos;
    }

    function QuotaPill(props) {
      const t = props && typeof props.t === "function" ? props.t : (key) => key;
      const [snapshot, setSnapshot] = React.useState(null);
      const [failed, setFailed] = React.useState(false);
      const [busy, setBusy] = React.useState(false);
      const [tick, setTick] = React.useState(0);
      const [open, setOpen] = React.useState(false);
      const anchorRef = React.useRef(null);
      const panelRef = React.useRef(null);
      const pos = useAnchoredPosition(open, anchorRef, panelRef);

      React.useEffect(() => {
        let stopped = false;
        let timer = null;
        const load = async () => {
          try {
            const response = await fetch(location.origin + ROUTE, {
              cache: "no-store",
              headers: { accept: "application/json" },
            });
            const payload = await response.json();
            if (!stopped) {
              setSnapshot(payload);
              setFailed(false);
            }
          } catch (_error) {
            if (!stopped) setFailed(true);
          } finally {
            if (!stopped) {
              setBusy(false);
              timer = setTimeout(load, REFRESH_MS);
            }
          }
        };
        load();
        const onVisibilityChange = () => {
          if (document.visibilityState === "visible") load();
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
          stopped = true;
          if (timer !== null) clearTimeout(timer);
          document.removeEventListener("visibilitychange", onVisibilityChange);
        };
      }, [tick]);

      React.useEffect(() => {
        if (!open) return;
        const onKeyDown = (event) => {
          if (event.key === "Escape") setOpen(false);
        };
        const onPointerDown = (event) => {
          const target = event.target;
          if (!(target instanceof Node)) return;
          if (anchorRef.current?.contains(target) === true) return;
          if (panelRef.current?.contains(target) === true) return;
          setOpen(false);
        };
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("pointerdown", onPointerDown, true);
        return () => {
          document.removeEventListener("keydown", onKeyDown);
          document.removeEventListener("pointerdown", onPointerDown, true);
        };
      }, [open]);

      const periods =
        snapshot && snapshot.ok === true && snapshot.periods && typeof snapshot.periods === "object"
          ? snapshot.periods
          : null;
      const ready = periods !== null;
      const notConfigured =
        snapshot !== null && snapshot.ok === false && snapshot.code === "credential_not_configured";

      // ---- trigger content -------------------------------------------------
      let children;
      if (notConfigured) {
        children = h("span", { className: "ocq_warn" }, t("notConfigured"));
      } else if (failed) {
        children = h("span", { className: "ocq_error" }, t("unavailable"));
      } else if (!ready) {
        children = h("span", null, t("loading"));
      } else {
        children = [];
        for (const key of PILL_PERIOD_KEYS) {
          const period = periods[key];
          if (!period || typeof period.percent !== "number") continue;
          if (children.length > 0) {
            children.push(h("span", { key: key + "-sep", className: "ocq_sep", "aria-hidden": true }, "·"));
          }
          children.push(
            h(
              React.Fragment,
              { key },
              h("span", null, t(key)),
              h("span", { style: { color: percentColor(period.percent) } }, ` ${period.percent}%`),
            ),
          );
        }
        if (children.length === 0) children = h("span", null, t("loading"));
      }

      const triggerTitle = open ? undefined : buildTitle(t, periods);

      // ---- detail panel ----------------------------------------------------
      let panel = null;
      if (open) {
        const rows = [];
        if (notConfigured) {
          rows.push(h("div", { key: "message", className: "ocq_message" }, t("notConfigured")));
        } else if (failed) {
          rows.push(h("div", { key: "message", className: "ocq_message" }, `${t("unavailable")} · ${t("retry")}`));
        } else if (!ready) {
          rows.push(h("div", { key: "message", className: "ocq_message" }, t("loading")));
        } else {
          for (const key of PERIOD_KEYS) {
            const period = periods[key];
            if (!period || typeof period.percent !== "number") continue;
            const color = percentColor(period.percent);
            const reset = formatReset(period.resetsAt);
            rows.push(
              h(
                "div",
                { key, className: "ocq_row" },
                h(
                  "div",
                  { className: "ocq_rowHead" },
                  h("span", { className: "ocq_rowName" }, t(key)),
                  h("span", { className: "ocq_rowUsed", style: { color } }, `${t("used")} ${period.percent}%`),
                  h("span", { className: "ocq_rowRemaining" }, `${t("remaining")} ${period.remainingPercent}%`),
                ),
                h("div", { className: "ocq_bar", role: "presentation" }, h("div", {
                  className: "ocq_barFill",
                  style: { width: `${Math.max(1, Math.min(100, period.percent))}%`, background: color },
                })),
                reset !== "" ? h("div", { className: "ocq_rowReset" }, `${t("resets")} ${reset}`) : null,
              ),
            );
          }
        }
        const updated = formatClock(snapshot?.generatedAt);
        panel = h(
          "div",
          {
            ref: panelRef,
            className: "ocq_panel",
            role: "dialog",
            "aria-label": t("label"),
            style:
              pos !== null
                ? { left: pos.left, top: pos.top }
                : { visibility: "hidden", left: 0, top: 0 },
          },
          h(
            "div",
            { className: "ocq_panelTitle" },
            h("span", { className: "ocq_panelTitleLabel" }, h(GaugeIcon), t("label")),
            updated !== "" ? h("span", { className: "ocq_panelTitleValue" }, `${t("updated")} ${updated}`) : null,
          ),
          h("div", { className: "ocq_rule" }),
          ...rows,
          h(
            "div",
            { className: "ocq_footer" },
            h(
              "button",
              {
                type: "button",
                className: "ocq_action",
                disabled: busy,
                onClick: () => {
                  setBusy(true);
                  setTick((value) => value + 1);
                },
              },
              t("refresh"),
            ),
            h(
              "a",
              {
                className: "ocq_action",
                href: CONSOLE_URL,
                target: "_blank",
                rel: "noreferrer noopener",
              },
              t("console"),
            ),
          ),
        );
        if (createPortal !== null) panel = createPortal(panel, document.body);
      }

      return h(
        "span",
        { className: "ocq_anchor", "data-composer-quota": "opencode-go", ref: anchorRef },
        h(
          "button",
          {
            type: "button",
            className: "ocq_pill",
            "aria-haspopup": "dialog",
            "aria-expanded": open,
            "aria-label": t("label") + " — " + buildTitle(t, periods),
            title: triggerTitle,
            onClick: () => setOpen((value) => !value),
          },
          h(GaugeIcon),
          h("span", { className: "ocq_label" }, ...(Array.isArray(children) ? children : [children])),
        ),
        panel,
      );
    }

    return {
      inject: ["slots", "locale"],
      apply(ctx) {
        ctx.effect(() => {
          const style = document.createElement("style");
          style.dataset.plugin = "dsh-opencode-quota-5h";
          style.textContent = CSS;
          document.head.appendChild(style);
          return () => {
            style.remove();
          };
        }, "opencode-quota: styles");
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), "opencode-quota: locale");
        ctx.slots.inject("conversation.composer.dock", () =>
          ctx.slots.register(
            { name: "conversation.composer.dock", id: "opencode-quota", order: ORDER, locale: NS },
            QuotaPill,
          ),
        );
      },
    };
  },
});
