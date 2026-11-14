import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import type { Game } from '@/features/games'
import { TeacherLibrariesExploreContent } from './TeacherLibrariesExploreContent'

const fixtureDate = '2026-05-20T08:00:00.000Z'

const libraryGames: Game[] = [
  {
    id: 'sunetul-initial',
    title: 'Sunetul inițial în cuvinte familiare',
    description: 'Elevii ascultă și aleg imaginea care începe cu același sunet.',
    thumbnail_url: null,
    game_url: '/games/listen-tap/index.html',
    category: 'phonics',
    difficulty_level: 1,
    target_age_min: 6,
    target_age_max: 7,
    estimated_duration: 8,
    learning_objectives: ['Identifică sunetul inițial', 'Asociază sunete cu imagini'],
    is_published: true,
    created_at: fixtureDate,
    updated_at: fixtureDate,
  },
  {
    id: 'numere-pana-la-100',
    title: 'Numere până la 100',
    description: 'Compară, ordonează și completează șiruri de numere pentru clasa I.',
    thumbnail_url: null,
    game_url: '/games/number-line/index.html',
    category: 'math',
    difficulty_level: 2,
    target_age_min: 6,
    target_age_max: 8,
    estimated_duration: 10,
    learning_objectives: ['Compară numere', 'Completează șiruri numerice'],
    is_published: true,
    created_at: fixtureDate,
    updated_at: fixtureDate,
  },
  {
    id: 'citeste-propozitia',
    title: 'Citește propoziția și potrivește imaginea',
    description: 'Exersează înțelegerea propozițiilor scurte prin alegerea imaginii corecte.',
    thumbnail_url: null,
    game_url: '/games/read-match/index.html',
    category: 'literacy',
    difficulty_level: 2,
    target_age_min: 6,
    target_age_max: 8,
    estimated_duration: 12,
    learning_objectives: ['Citește propoziții scurte', 'Verifică înțelegerea textului'],
    is_published: true,
    created_at: fixtureDate,
    updated_at: fixtureDate,
  },
  {
    id: 'forme-in-clasa',
    title: 'Vânătoare de forme în clasă',
    description: 'Recunoaște cercuri, pătrate și triunghiuri în obiecte din sala de clasă.',
    thumbnail_url: null,
    game_url: '/games/shapes-hunt/index.html',
    category: 'shapes',
    difficulty_level: 1,
    target_age_min: 5,
    target_age_max: 7,
    estimated_duration: 7,
    learning_objectives: ['Recunoaște forme geometrice', 'Clasifică obiecte după formă'],
    is_published: true,
    created_at: fixtureDate,
    updated_at: fixtureDate,
  },
  {
    id: 'culori-si-modele',
    title: 'Culori și modele repetitive',
    description: 'Continuă modele cu mărgele colorate și explică regula folosită.',
    thumbnail_url: null,
    game_url: '/games/patterns/index.html',
    category: 'colors',
    difficulty_level: 1,
    target_age_min: 5,
    target_age_max: 7,
    estimated_duration: 9,
    learning_objectives: ['Recunoaște modele', 'Continuă secvențe de culori'],
    is_published: true,
    created_at: fixtureDate,
    updated_at: fixtureDate,
  },
  {
    id: 'cuvinte-din-poveste',
    title: 'Cuvinte noi din povestea zilei',
    description: 'Alege sensul potrivit pentru cuvinte noi întâlnite într-o poveste scurtă.',
    thumbnail_url: null,
    game_url: '/games/vocabulary-story/index.html',
    category: 'vocabulary',
    difficulty_level: 2,
    target_age_min: 7,
    target_age_max: 9,
    estimated_duration: 11,
    learning_objectives: ['Îmbogățește vocabularul', 'Folosește contextul pentru sens'],
    is_published: true,
    created_at: fixtureDate,
    updated_at: fixtureDate,
  },
  {
    id: 'adunari-cu-obiecte',
    title: 'Adunări cu obiecte din clasă',
    description: 'Rezolvă adunări simple folosind grupuri vizuale de obiecte.',
    thumbnail_url: null,
    game_url: '/games/addition-objects/index.html',
    category: 'math',
    difficulty_level: 1,
    target_age_min: 6,
    target_age_max: 7,
    estimated_duration: 8,
    learning_objectives: ['Modelează adunarea', 'Rezolvă exerciții cu suport vizual'],
    is_published: true,
    created_at: fixtureDate,
    updated_at: fixtureDate,
  },
  {
    id: 'litere-amestecate',
    title: 'Litere amestecate în cuvânt',
    description: 'Reordonează literele pentru a forma cuvinte scurte și familiare.',
    thumbnail_url: null,
    game_url: '/games/word-builder/index.html',
    category: 'literacy',
    difficulty_level: 2,
    target_age_min: 6,
    target_age_max: 8,
    estimated_duration: 10,
    learning_objectives: ['Construiește cuvinte', 'Recunoaște structura cuvântului'],
    is_published: true,
    created_at: fixtureDate,
    updated_at: fixtureDate,
  },
]

const meta = {
  title: 'Teacher Dashboard/Libraries Explore Content',
  component: TeacherLibrariesExploreContent,
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/teacher/libraries/explore',
        query: {},
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-surface)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TeacherLibrariesExploreContent>

export default meta

type Story = StoryObj<typeof meta>

export const ExploreLibrary: Story = {
  args: {
    games: libraryGames,
  },
}
