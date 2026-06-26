import React from 'react';
import styled from 'styled-components';
import { formatCustomEventDateTime, describeCustomVisibility } from '../utils/customCalendarEvents';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  z-index: 2250;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 4vh 1rem 2rem;
  overflow-y: auto;
`;

const Panel = styled.div`
  background: #fff;
  border-radius: 14px;
  width: 100%;
  max-width: 480px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.3);
  overflow: hidden;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  color: #fff;
  padding: 1rem 1.2rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
`;

const CloseBtn = styled.button`
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.35);
  color: #fff;
  border-radius: 8px;
  padding: 0.35rem 0.75rem;
  font-weight: 700;
  cursor: pointer;
`;

const Body = styled.div`
  padding: 1.1rem 1.2rem 1.25rem;
`;

const Field = styled.div`
  margin-bottom: 0.75rem;
`;

const Label = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #64748b;
  margin-bottom: 0.25rem;
`;

const Value = styled.div`
  font-size: 0.9rem;
  color: #1e293b;
  line-height: 1.45;
  white-space: pre-wrap;
`;

export default function CalendarCustomEventView({ isOpen, event, onClose }) {
  if (!isOpen || !event) return null;

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Ειδοποίηση ημερολογίου</Title>
          <CloseBtn type="button" onClick={onClose}>Κλείσιμο</CloseBtn>
        </Header>
        <Body>
          <Field>
            <Label>Τίτλος</Label>
            <Value>{event.title || '—'}</Value>
          </Field>
          <Field>
            <Label>Ημερομηνία</Label>
            <Value>{formatCustomEventDateTime(event.dateIso)}</Value>
          </Field>
          {event.description && (
            <Field>
              <Label>Περιγραφή</Label>
              <Value>{event.description}</Value>
            </Field>
          )}
          <Field>
            <Label>Ορατότητα</Label>
            <Value>{describeCustomVisibility(event)}</Value>
          </Field>
          {event.createdByFullName && (
            <Field>
              <Label>Δημιουργός</Label>
              <Value>{event.createdByFullName}</Value>
            </Field>
          )}
        </Body>
      </Panel>
    </Overlay>
  );
}
