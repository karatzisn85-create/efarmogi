/**
 * Κοινό οπτικό chrome φορμών (πρότυπο: EntaxisForm).
 * Μόνο εμφάνιση — χωρίς λογική πεδίων.
 */
import styled from 'styled-components';

export const FormOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: linear-gradient(
    145deg,
    rgba(15, 23, 42, 0.78) 0%,
    rgba(49, 46, 129, 0.55) 45%,
    rgba(15, 23, 42, 0.72) 100%
  );
  backdrop-filter: blur(4px);
  z-index: 10001;
  padding: 1.5rem 1rem 2rem;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: flex-start;
`;

export const FormContainer = styled.div`
  background: #ffffff;
  border-radius: 18px;
  max-width: min(920px, calc(100vw - 2rem));
  width: 100%;
  margin: auto 0;
  flex-shrink: 0;
  box-shadow:
    0 4px 6px rgba(15, 23, 42, 0.06),
    0 24px 48px rgba(30, 27, 75, 0.28),
    0 0 0 1px rgba(255, 255, 255, 0.06) inset;
  border: 1px solid #e2e8f0;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
`;

export const FormHero = styled.div`
  padding: 1.35rem 1.65rem 1.4rem;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 42%, #4338ca 100%);
  color: #fff;
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 80% 70% at 85% 0%, rgba(255, 255, 255, 0.22), transparent 55%);
    pointer-events: none;
  }
`;

export const HeroText = styled.div`
  position: relative;
  z-index: 1;
  min-width: 0;
  flex: 1;
`;

export const HeroEyebrow = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.88;
  margin-bottom: 0.35rem;
`;

export const FormTitle = styled.h2`
  margin: 0;
  font-size: 1.42rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: #fff;
`;

export const HeroSubtitle = styled.p`
  margin: 0.45rem 0 0;
  font-size: 0.88rem;
  font-weight: 500;
  line-height: 1.45;
  opacity: 0.92;
  max-width: 40rem;
`;

export const CloseButton = styled.button`
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.28);
  padding: 0.45rem 0.85rem;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 700;
  font-family: inherit;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.24);
    border-color: rgba(255, 255, 255, 0.4);
  }
`;

export const FormBody = styled.div`
  padding: 1.35rem 1.65rem 1.65rem;
  background: linear-gradient(180deg, #fafbff 0%, #ffffff 28%);
`;

export const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem 1.15rem;
  width: 100%;
  min-width: 0;

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export const FormGroup = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== 'fullWidth',
})`
  display: flex;
  flex-direction: column;
  gap: 0.38rem;
  min-width: 0;
  max-width: 100%;

  ${(props) =>
    props.fullWidth &&
    `
    grid-column: 1 / -1;
  `}
`;

export const Label = styled.label`
  display: block;
  font-size: 0.82rem;
  font-weight: 700;
  color: #475569;
`;

export const RequiredMark = styled.span`
  color: #dc2626;
  margin-left: 0.15rem;
`;

export const Input = styled.input`
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.62rem 0.88rem;
  border: 1px solid #e2e8f0;
  border-radius: 11px;
  font-size: 0.96rem;
  font-family: inherit;
  min-height: 46px;
  background: #fff;
  color: #0f172a;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:focus {
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
  }

  &:disabled {
    background-color: #f8fafc;
    cursor: not-allowed;
  }
`;

export const TextArea = styled.textarea`
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.68rem 0.9rem;
  border: 1px solid #e2e8f0;
  border-radius: 11px;
  font-size: 0.96rem;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  resize: vertical;
  min-height: 110px;
  font-family: inherit;
  line-height: 1.52;
  background: #fff;
  color: #0f172a;
  word-wrap: break-word;
  white-space: pre-wrap;
  overflow-wrap: break-word;

  &:focus {
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
  }
`;

export const Select = styled.select`
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.62rem 0.88rem;
  border: 1px solid #e2e8f0;
  border-radius: 11px;
  font-size: 0.96rem;
  font-family: inherit;
  min-height: 46px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  background: #fff;
  color: #334155;
  cursor: pointer;

  &:focus {
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
  }
`;

export const FileSelectButton = styled.button`
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.7rem 1rem;
  background: #fff;
  color: #3730a3;
  border: 1.5px dashed #a5b4fc;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover {
    background: #eef2ff;
    border-color: #818cf8;
    color: #312e81;
  }
`;

export const ErrorMessage = styled.div`
  color: #b91c1c;
  font-size: 0.78rem;
  font-weight: 600;
  margin-top: 0.15rem;
`;

export const ButtonContainer = styled.div`
  display: flex;
  gap: 0.65rem;
  justify-content: flex-end;
  flex-wrap: wrap;
  padding-top: 1.15rem;
  margin-top: 0.35rem;
  border-top: 1px solid #e2e8f0;
  min-width: 0;
  max-width: 100%;
`;

export const Button = styled.button.withConfig({
  shouldForwardProp: (prop) => prop !== 'primary',
})`
  padding: 0.58rem 1.35rem;
  border-radius: 11px;
  font-size: 0.93rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  min-height: 46px;
  border: none;
  transition: background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;

  ${(props) =>
    props.primary
      ? `
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: #fff;
    box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);

    &:hover:not(:disabled) {
      box-shadow: 0 6px 18px rgba(79, 70, 229, 0.42);
    }
  `
      : `
    background: #fff;
    color: #475569;
    border: 1px solid #e2e8f0;

    &:hover:not(:disabled) {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
  `}

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const filterChangedProp = {
  shouldForwardProp: (prop) => prop !== 'changed',
};

/** Πεδίο που άλλαξε σε τροποποίηση — amber accent (συμπεριφορικό σήμα) */
export const ChangedLabel = styled(Label).withConfig(filterChangedProp)`
  display: flex;
  align-items: center;
  gap: 0.5rem;

  ${(props) =>
    props.changed &&
    `
    color: #d97706;
    font-weight: 800;

    &::after {
      content: "●";
      color: #f59e0b;
      font-size: 0.75rem;
    }
  `}
`;

export const ChangedInput = styled(Input).withConfig(filterChangedProp)`
  border-color: ${(props) => (props.changed ? '#f59e0b' : '#e2e8f0')};

  &:focus {
    border-color: ${(props) => (props.changed ? '#f59e0b' : '#818cf8')};
    box-shadow: 0 0 0 3px
      ${(props) =>
        props.changed ? 'rgba(245, 158, 11, 0.22)' : 'rgba(99, 102, 241, 0.18)'};
  }
`;

export const ChangedTextArea = styled(TextArea).withConfig(filterChangedProp)`
  border-color: ${(props) => (props.changed ? '#f59e0b' : '#e2e8f0')};

  &:focus {
    border-color: ${(props) => (props.changed ? '#f59e0b' : '#818cf8')};
    box-shadow: 0 0 0 3px
      ${(props) =>
        props.changed ? 'rgba(245, 158, 11, 0.22)' : 'rgba(99, 102, 241, 0.18)'};
  }
`;

export const ChangedSelect = styled(Select).withConfig(filterChangedProp)`
  border-color: ${(props) => (props.changed ? '#f59e0b' : '#e2e8f0')};

  &:focus {
    border-color: ${(props) => (props.changed ? '#f59e0b' : '#818cf8')};
    box-shadow: 0 0 0 3px
      ${(props) =>
        props.changed ? 'rgba(245, 158, 11, 0.22)' : 'rgba(99, 102, 241, 0.18)'};
  }
`;
