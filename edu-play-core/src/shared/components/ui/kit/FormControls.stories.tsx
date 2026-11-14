import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Checkbox } from './Checkbox';
import { TextareaField } from './TextareaField';
import { TextField } from './TextField';

const meta = {
  title: 'UI Kit/Form controls',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Standard: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 20, width: 420 }}>
      <TextField
        label="Adresă de email"
        type="email"
        icon="Envelope"
        helper="Folosim adresa pentru invitațiile clasei."
        placeholder="profesor@scoala.ro"
      />
      <TextField
        label="Parolă"
        type="password"
        helper="Minim 8 caractere."
        placeholder="Introdu parola"
      />
      <TextareaField
        label="Instrucțiuni pentru elevi"
        helper="Scrie ce trebuie să facă elevii înainte de joc."
        placeholder="Citește cerința, apoi apasă Start."
      />
      <Checkbox label="Trimite rezumatul către părinți" />
    </div>
  ),
};

export const ErrorStates: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 20, width: 420 }}>
      <TextField label="Parolă" type="password" error="Parola este obligatorie." />
      <TextareaField
        label="Feedback"
        error="Feedbackul trebuie completat înainte de trimitere."
      />
      <Checkbox label="Accept termenii școlii" error="Bifează pentru a continua." />
    </div>
  ),
};

export const DisabledAndSuccess: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 20, width: 420 }}>
      <TextField label="Cod clasă" value="RO-2481" success readOnly />
      <TextField label="Școală" value="Școala Gimnazială 12" disabled />
      <TextareaField
        label="Notițe"
        value="Setările sunt blocate pentru acest rol."
        disabled
      />
      <Checkbox label="Notificări active" checked disabled readOnly />
    </div>
  ),
};

export const MobileWidth: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  render: () => (
    <div style={{ display: 'grid', gap: 18, width: 320 }}>
      <TextField
        label="Nume elev"
        helper="Apare în rapoartele pentru familie."
        placeholder="Ana Popescu"
      />
      <TextareaField
        label="Observații"
        helper="Textul se poate întinde pe mai multe rânduri."
      />
      <Checkbox label="Păstrează setările pentru următoarea activitate" />
    </div>
  ),
};
