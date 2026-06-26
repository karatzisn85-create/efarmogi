import React, { useState, useRef, useEffect } from 'react';
import styled, { css } from 'styled-components';

// ── Styled ────────────────────────────────────────────────────────────────────

const Wrap = styled.div`
  position: relative;
`;

const LabelRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-bottom: 0.3rem;
`;

const FieldLabel = styled.label`
  font-size: 0.78rem;
  font-weight: 700;
  color: #374151;
`;

const KhmdhsBadge = styled.span`
  font-size: 0.62rem;
  font-weight: 700;
  padding: 0.1rem 0.38rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.1);
  color: #4338ca;
  border: 1px solid rgba(99, 102, 241, 0.25);
  white-space: nowrap;
`;

const EditedBadge = styled.span`
  font-size: 0.62rem;
  font-weight: 700;
  padding: 0.1rem 0.38rem;
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.1);
  color: #92400e;
  border: 1px solid rgba(245, 158, 11, 0.3);
  white-space: nowrap;
`;

const UndoBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.62rem;
  font-weight: 700;
  padding: 0.1rem 0.35rem;
  border-radius: 999px;
  background: transparent;
  color: #6b7280;
  border: 1px solid #d1d5db;
  cursor: pointer;
  line-height: 1;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: #f9fafb;
    color: #374151;
  }
`;

const FieldBody = styled.div`
  position: relative;
  display: flex;
  align-items: stretch;
`;

const ReadOnlyDisplay = styled.div`
  flex: 1;
  padding: 0.4rem 2rem 0.4rem 0.65rem;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #1e293b;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.2);
  min-height: 36px;
  display: flex;
  align-items: center;
  word-break: break-word;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: rgba(99, 102, 241, 0.08);
    border-color: rgba(99, 102, 241, 0.35);
  }
`;

const EditIconBtn = styled.button`
  position: absolute;
  right: 0.4rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #6366f1;
  font-size: 0.75rem;
  border-radius: 4px;
  transition: background 0.15s;
  padding: 0;

  &:hover {
    background: rgba(99, 102, 241, 0.12);
  }
`;

const EditableInput = styled.input`
  flex: 1;
  padding: 0.4rem 0.65rem;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #1e293b;
  background: #fff;
  border: 1.5px solid #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:focus {
    border-color: #4f46e5;
    box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.18);
  }
`;

const EmptyPlaceholder = styled.span`
  color: #94a3b8;
  font-weight: 400;
  font-style: italic;
`;

/**
 * Read-only display για ΚΗΜΔΗΣ-filled field με inline edit toggle.
 *
 * Χρησιμοποιείται αντί για `renderFieldLabel(label, true, key)` + `<Input>`.
 *
 * @param {{
 *   label: string,
 *   value: string,
 *   khmdhsValue?: string,     -- Αρχική τιμή από ΚΗΜΔΗΣ (για σύγκριση)
 *   locked: boolean,           -- true = ΚΗΜΔΗΣ έχει δώσει τιμή → read-only by default
 *   onChange: (v: string) => void,
 *   onBlur?: () => void,
 *   type?: string,
 *   placeholder?: string,
 *   required?: boolean,
 *   error?: string,
 * }} props
 */
export default function KhmdhsInlineField({
  label,
  value,
  khmdhsValue,
  locked = false,
  onChange,
  onBlur,
  type = 'text',
  placeholder = '',
  required = false,
  error,
}) {
  const [editing, setEditing] = useState(!locked);
  const inputRef = useRef(null);

  const isEdited = locked && khmdhsValue != null
    && String(value || '').trim() !== String(khmdhsValue || '').trim()
    && String(value || '').trim() !== '';

  // When locked changes to true (e.g., new ΚΗΜΔΗΣ fetch), reset to read-only
  useEffect(() => {
    if (locked) setEditing(false);
  }, [locked]);

  const handleEditClick = () => {
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const handleUndo = () => {
    onChange(khmdhsValue || '');
    setEditing(false);
  };

  const displayValue = value || '';

  return (
    <Wrap>
      <LabelRow>
        <FieldLabel>
          {label}{required && ' *'}
        </FieldLabel>
        {locked && !isEdited && <KhmdhsBadge>από ΚΗΜΔΗΣ</KhmdhsBadge>}
        {locked && isEdited && (
          <>
            <EditedBadge>επεξεργάστηκε</EditedBadge>
            {khmdhsValue != null && (
              <UndoBtn type="button" onClick={handleUndo} title="Επαναφορά τιμής ΚΗΜΔΗΣ">
                ↺ αναίρεση
              </UndoBtn>
            )}
          </>
        )}
      </LabelRow>

      <FieldBody>
        {locked && !editing ? (
          <>
            <ReadOnlyDisplay onClick={handleEditClick} title="Κλικ για επεξεργασία">
              {displayValue
                ? displayValue
                : <EmptyPlaceholder>{placeholder || 'Δεν έχει τιμή'}</EmptyPlaceholder>
              }
            </ReadOnlyDisplay>
            <EditIconBtn
              type="button"
              onClick={handleEditClick}
              title="Επεξεργασία πεδίου"
              aria-label="Επεξεργασία πεδίου"
            >
              ✎
            </EditIconBtn>
          </>
        ) : (
          <EditableInput
            ref={inputRef}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => {
              if (locked && String(value || '').trim() === String(khmdhsValue || '').trim()) {
                setEditing(false);
              }
              onBlur?.();
            }}
            placeholder={placeholder}
          />
        )}
      </FieldBody>

      {error && (
        <div style={{ fontSize: '0.73rem', color: '#ef4444', marginTop: '0.25rem', fontWeight: 600 }}>
          {error}
        </div>
      )}
    </Wrap>
  );
}
