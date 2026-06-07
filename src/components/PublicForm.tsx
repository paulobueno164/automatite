"use client";

import { useEffect, useMemo, useState } from "react";
import { FormConfig, FormFieldDef, interpolateFormText } from "@/lib/form-config";
import {
  FORM_SCOPE_CLASS,
  parseFormHtmlSegments,
  resolveFormHtmlParts,
  usesCustomHtml,
  FormHtmlSegment,
} from "@/lib/form-template";
import { ExecutionStep } from "@/lib/flow-types";
import { FormFieldInput } from "./FormFieldInput";

export function PublicForm({
  automationId,
  config,
  compact = false,
  standalone = false,
  showTitle = true,
}: {
  automationId: string;
  config: FormConfig;
  compact?: boolean;
  /** Página pública em /f/[id] — ocupa a tela inteira, sem layout do sistema. */
  standalone?: boolean;
  showTitle?: boolean;
}) {
  const { fields, style, success } = config;
  const title = config.title;
  const description = config.description;
  const customMode = !compact && usesCustomHtml(config);

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.id, ""]))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submittedValues, setSubmittedValues] = useState<Record<string, string>>({});
  const [steps, setSteps] = useState<ExecutionStep[] | null>(null);
  const [customReady, setCustomReady] = useState(false);

  useEffect(() => {
    if (customMode) setCustomReady(true);
  }, [customMode]);

  const { html: customHtml, css: customCss } = useMemo(
    () => (customMode ? resolveFormHtmlParts(config) : { html: "", css: "" }),
    [customMode, config]
  );

  const htmlSegments = useMemo(
    () => (customMode && customReady ? parseFormHtmlSegments(customHtml) : null),
    [customMode, customReady, customHtml]
  );

  function setField(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function resetForm() {
    setSubmitted(false);
    setSubmittedValues({});
    setSteps(null);
    setError(null);
    setValues(Object.fromEntries(fields.map((f) => [f.id, ""])));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    for (const field of fields) {
      if (field.required && !values[field.id]?.trim()) {
        setError(`Preencha o campo "${field.label}".`);
        return;
      }
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/trigger/${automationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível enviar");
      setSubmittedValues({ ...values });
      setSubmitted(true);
      if (compact && data.steps) setSteps(data.steps);
      setValues(Object.fromEntries(fields.map((f) => [f.id, ""])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setBusy(false);
    }
  }

  const pageStyle: React.CSSProperties = compact
    ? {}
    : standalone
      ? customMode
        ? { minHeight: "100vh", padding: "2rem 1rem" }
        : {
            backgroundColor: style.backgroundColor,
            backgroundImage: style.backgroundImageUrl ? `url(${style.backgroundImageUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            minHeight: "100vh",
            padding: "2rem 1rem",
          }
      : customMode
        ? {
            minHeight: "100%",
            margin: "-2rem -1rem",
            padding: "2rem 1rem",
            width: "calc(100% + 2rem)",
          }
        : {
            backgroundColor: style.backgroundColor,
            backgroundImage: style.backgroundImageUrl ? `url(${style.backgroundImageUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            minHeight: "100%",
            margin: "-2rem -1rem",
            padding: "2rem 1rem",
          };

  const cardStyle: React.CSSProperties = {
    backgroundColor: style.cardBackground,
    borderColor: `${style.accentColor}22`,
  };

  const buttonStyle: React.CSSProperties = {
    backgroundColor: style.accentColor,
    borderColor: style.accentColor,
  };

  const submitBtn = (fullWidth = true) => (
    <button
      type="submit"
      disabled={busy}
      className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60 ${fullWidth ? "w-full" : ""}`}
      style={buttonStyle}
    >
      {busy ? "Enviando…" : compact ? "▶ Testar automação" : style.buttonLabel}
    </button>
  );

  const errorBlock = error ? <p className="text-sm text-red-600">{error}</p> : null;

  if (submitted && !compact) {
    return (
      <div style={pageStyle}>
        <div className="mx-auto max-w-lg rounded-2xl border p-8 text-center shadow-sm" style={cardStyle}>
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white"
            style={{ backgroundColor: style.accentColor }}
          >
            ✓
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {interpolateFormText(success.title, submittedValues)}
          </h1>
          <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">
            {interpolateFormText(success.message, submittedValues)}
          </p>
          {success.showAnotherButton && (
            <button
              type="button"
              onClick={resetForm}
              className="mt-6 rounded-lg px-5 py-2.5 text-sm font-medium text-white"
              style={buttonStyle}
            >
              {success.anotherButtonLabel}
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderFieldsBlock(gap = "space-y-4") {
    return (
      <div className={gap}>
        {fields.map((field) => (
          <FormFieldInput
            key={field.id}
            field={field}
            value={values[field.id] ?? ""}
            onChange={(v) => setField(field.id, v)}
            accent={style.accentColor}
          />
        ))}
      </div>
    );
  }

  function renderSegment(seg: FormHtmlSegment, fieldsById: Map<string, FormFieldDef>) {
    switch (seg.kind) {
      case "html": {
        const html = seg.content
          .replace(/\{cor\}/g, style.accentColor)
          .replace(/\{fundo_card\}/g, style.cardBackground)
          .trim();
        if (!html) return null;
        return <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
      }
      case "titulo":
        return (
          <h1 key="titulo" style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#0f172a" }}>
            {title}
          </h1>
        );
      case "descricao":
        return description ? (
          <p key="descricao" style={{ margin: "8px 0 0", fontSize: "14px", color: "#64748b" }}>
            {description}
          </p>
        ) : null;
      case "campos":
        return <div key="campos">{renderFieldsBlock("space-y-4")}</div>;
      case "campo": {
        const field = fieldsById.get(seg.fieldId);
        if (!field) return null;
        return (
          <FormFieldInput
            key={`campo-${seg.fieldId}`}
            field={field}
            value={values[field.id] ?? ""}
            onChange={(v) => setField(field.id, v)}
            accent={style.accentColor}
            bare
          />
        );
      }
      case "erro":
        return <div key="erro">{errorBlock}</div>;
      case "botao":
        return <div key="botao">{submitBtn(true)}</div>;
      default:
        return null;
    }
  }

  const fieldsById = useMemo(() => new Map(fields.map((f) => [f.id, f])), [fields]);

  if (customMode && !customReady) {
    return (
      <div className={FORM_SCOPE_CLASS} style={pageStyle} aria-busy="true">
        <div className="mx-auto h-64 max-w-2xl animate-pulse rounded-xl bg-slate-200/30" />
      </div>
    );
  }

  if (customMode && htmlSegments) {
    const hasBotao = htmlSegments.some((s) => s.kind === "botao");
    const hasErro = htmlSegments.some((s) => s.kind === "erro");

    return (
      <div className={FORM_SCOPE_CLASS} style={pageStyle}>
        {customCss ? <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: customCss }} /> : null}
        <form onSubmit={submit} className="mx-auto w-full max-w-2xl">
          {htmlSegments.map((seg, i) => (
            <div key={i}>{renderSegment(seg, fieldsById)}</div>
          ))}
          {!hasErro && errorBlock && <div className="mt-2">{errorBlock}</div>}
          {!hasBotao && <div className="mt-4">{submitBtn(true)}</div>}
        </form>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <form
        onSubmit={submit}
        className={compact ? "space-y-3" : "mx-auto max-w-lg space-y-4 rounded-2xl border p-6 shadow-sm"}
        style={compact ? undefined : cardStyle}
      >
        {showTitle && !compact && (
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
        )}

        {renderFieldsBlock(compact ? "space-y-3" : "space-y-4")}

        {errorBlock}

        {submitted && compact && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {interpolateFormText(success.title, submittedValues)}
          </div>
        )}

        {steps && (
          <ol className="space-y-1">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2 rounded bg-slate-50 p-2 text-xs">
                <span className={s.status === "success" ? "text-green-600" : "text-red-600"}>
                  {s.status === "success" ? "✓" : "✕"}
                </span>
                <span>
                  <strong>{s.label}</strong> — {s.detail}
                </span>
              </li>
            ))}
          </ol>
        )}

        {submitBtn(true)}
      </form>
    </div>
  );
}
