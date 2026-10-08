"use client";

import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/contexts/authContext";
import { getAuthErrorCopy } from "@/helpers/apiErrors";
import {
  buildPayload,
  buildUpdatePayload,
  emptyValues,
  getVisibleFields,
  hasFormErrors,
  validateForm,
  valuesFromRecord,
} from "@/helpers/recordForm";
import type { AuthedRequest } from "@/services/finance/records";
import type { CrossFieldRule, FieldConfig, FormValues } from "@/types/RecordFormTypes";

type Mode = "create" | "edit" | null;

export type RecordsScreen<TItem> = {
  mode: Mode;
  editingId: string | null;
  isDialogOpen: boolean;
  isSubmitting: boolean;
  isDeleteOpen: boolean;
  pendingDeleteId: string | null;
  values: FormValues;
  visibleFields: FieldConfig[];
  errors: Record<string, string>;
  banner: string | null;
  openCreate: () => void;
  openEdit: (item: TItem) => void;
  close: () => void;
  handleChange: (name: string, value: string | boolean) => void;
  handleBlur: (name: string) => void;
  submit: () => Promise<void>;
  askDelete: (item: TItem) => void;
  closeDelete: () => void;
  confirmDelete: () => Promise<void>;
  getId: (item: TItem) => string;
};

/**
 * Create, edit and delete state for one resource, plus the rules that make those
 * three behave identically across loans, incomes, expenses and goals:
 *
 * - A field shows its message only once it has been touched, or after a submit.
 * - Create sends every filled field; edit sends only what actually changed,
 *   because `PATCH` is partial and an unchanged field sent again is needless.
 * - A blank optional is omitted from the body rather than sent as `null`.
 * - A field-attached error from the server wins over the mirrored local one.
 */
export const useRecordsScreen = <TItem,>(config: {
  fields: FieldConfig[];
  crossFieldRules?: CrossFieldRule[];
  createDefaults?: FormValues;
  recordToValues: (item: TItem) => Record<string, unknown>;
  /**
   * Fills in the fields the record does not carry, from the ones it does.
   *
   * For a form-only field: the API stores the term, and the end date is arithmetic over it, so
   * opening a record for editing has to work that sum out or the box would open blank next to
   * three dropdowns that plainly already hold an answer.
   */
  deriveEditValues?: (
    seeded: FormValues,
    record: Record<string, unknown>
  ) => FormValues;
  /**
   * What one change does to the other fields, beyond the field itself.
   *
   * Two dates that are the same fact entered twice cannot both be sent, so whichever the user
   * touched last wins and the others are rewritten under their hands. Returning a patch — rather
   * than the whole next state — keeps the rule free to leave everything else alone.
   */
  applyChange?: (change: {
    name: string;
    value: string | boolean;
    current: FormValues;
  }) => FormValues;
  getId: (item: TItem) => string;
  create: (request: AuthedRequest, payload: Record<string, unknown>) => Promise<TItem>;
  update: (
    request: AuthedRequest,
    id: string,
    payload: Record<string, unknown>
  ) => Promise<TItem>;
  remove: (request: AuthedRequest, id: string) => Promise<void>;
  onMutated: () => void;
}) => {
  const { authorisedRequest } = useAuth();
  const {
    fields,
    crossFieldRules = [],
    createDefaults,
    recordToValues,
    deriveEditValues,
    applyChange,
    getId,
    create,
    update,
    remove,
    onMutated,
  } = config;

  const [mode, setMode] = useState<Mode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [originalValues, setOriginalValues] = useState<FormValues>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const visibleFields = useMemo(() => getVisibleFields(fields, values), [fields, values]);
  const localErrors = useMemo(
    () => validateForm(fields, values, crossFieldRules),
    [crossFieldRules, fields, values]
  );

  /**
   * What the user actually sees: a server-attached message always wins, and a
   * local one appears only once the field has been touched.
   */
  const visibleErrors = useMemo(() => {
    const merged: Record<string, string> = {};

    for (const field of visibleFields) {
      const serverMessage = serverErrors[field.name];
      if (serverMessage) {
        merged[field.name] = serverMessage;
        continue;
      }

      if (touched[field.name]) {
        const localMessage = localErrors[field.name];
        if (localMessage) {
          merged[field.name] = localMessage;
        }
      }
    }

    return merged;
  }, [localErrors, serverErrors, touched, visibleFields]);

  const reset = useCallback(() => {
    setValues({});
    setOriginalValues({});
    setTouched({});
    setServerErrors({});
    setBanner(null);
    setEditingId(null);
    setMode(null);
  }, []);

  const openCreate = useCallback(() => {
    const initial = { ...emptyValues(fields), ...(createDefaults ?? {}) };
    setValues(initial);
    setOriginalValues(initial);
    setTouched({});
    setServerErrors({});
    setBanner(null);
    setEditingId(null);
    setMode("create");
  }, [createDefaults, fields]);

  const openEdit = useCallback(
    (item: TItem) => {
      const record = recordToValues(item);
      const seeded = deriveEditValues
        ? deriveEditValues(valuesFromRecord(record, fields), record)
        : valuesFromRecord(record, fields);
      setValues(seeded);
      setOriginalValues(seeded);
      setTouched({});
      setServerErrors({});
      setBanner(null);
      setEditingId(getId(item));
      setMode("edit");
    },
    [deriveEditValues, fields, getId, recordToValues]
  );

  const close = useCallback(() => {
    reset();
  }, [reset]);

  const handleChange = useCallback(
    (name: string, value: string | boolean) => {
      setValues((current) => ({
        ...current,
        [name]: value,
        // The rule runs against the state *before* the change, so it reads the sibling fields as
        // they stand — the same state the user last saw. It is given the new value explicitly
        // and never returns a patch naming the field that changed, so the two cannot collide.
        ...(applyChange ? applyChange({ name, value, current }) : {}),
      }));

      // A stale server message on a field the user is correcting is worse than none.
      setServerErrors((current) => {
        if (!(name in current)) {
          return current;
        }
        const { [name]: _removed, ...rest } = current;
        return rest;
      });
      setBanner(null);
    },
    [applyChange]
  );

  const handleBlur = useCallback((name: string) => {
    setTouched((current) => (current[name] ? current : { ...current, [name]: true }));
  }, []);

  const submit = useCallback(async () => {
    // Everything is revealed on a submit attempt, so nothing is silently skipped.
    setTouched(Object.fromEntries(fields.map((field) => [field.name, true])));
    setBanner(null);

    const validation = validateForm(fields, values, crossFieldRules);
    if (hasFormErrors(validation)) {
      return;
    }

    setIsSubmitting(true);
    setServerErrors({});

    try {
      if (mode === "edit" && editingId) {
        const payload = buildUpdatePayload(fields, originalValues, values);
        // Nothing changed, so there is no request to make.
        if (Object.keys(payload).length === 0) {
          reset();
          return;
        }
        await update(authorisedRequest, editingId, payload);
      } else {
        await create(authorisedRequest, buildPayload(fields, values));
      }

      reset();
      onMutated();
    } catch (error) {
      const copy = getAuthErrorCopy(error);
      setBanner(copy.banner);
      setServerErrors(copy.fields);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    authorisedRequest,
    create,
    crossFieldRules,
    editingId,
    fields,
    mode,
    onMutated,
    originalValues,
    reset,
    update,
    values,
  ]);

  const askDelete = useCallback(
    (item: TItem) => {
      setPendingDeleteId(getId(item));
    },
    [getId]
  );

  const closeDelete = useCallback(() => {
    setPendingDeleteId(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId) {
      return;
    }

    setBanner(null);

    try {
      await remove(authorisedRequest, pendingDeleteId);
      setPendingDeleteId(null);
      onMutated();
    } catch (error) {
      setBanner(getAuthErrorCopy(error).banner);
      setPendingDeleteId(null);
    }
  }, [authorisedRequest, onMutated, pendingDeleteId, remove]);

  return {
    mode,
    editingId,
    isDialogOpen: mode !== null,
    isSubmitting,
    isDeleteOpen: pendingDeleteId !== null,
    pendingDeleteId,
    values,
    visibleFields,
    errors: visibleErrors,
    banner,
    openCreate,
    openEdit,
    close,
    handleChange,
    handleBlur,
    submit,
    askDelete,
    closeDelete,
    confirmDelete,
    getId,
  };
};